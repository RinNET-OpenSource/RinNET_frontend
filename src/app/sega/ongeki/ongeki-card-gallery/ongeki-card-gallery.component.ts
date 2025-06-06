import {Component, OnInit, TemplateRef} from '@angular/core';
import {HttpParams} from '@angular/common/http';
import {ApiService} from '../../../api.service';
import {MessageService} from '../../../message.service';
import {NgxIndexedDBService} from 'ngx-indexed-db';
import {OngekiCard} from '../model/OngekiCard';
import {OngekiCharacter} from '../model/OngekiCharacter';
import {PlayerCard} from '../model/PlayerCard';
import {Observable, combineLatest, lastValueFrom, map, tap, startWith, ReplaySubject} from 'rxjs';
import {environment} from '../../../../environments/environment';
import {OngekiSkill} from '../model/OngekiSkill';
import {ActivatedRoute, Router} from '@angular/router';
import {animate, state, style, transition, trigger} from '@angular/animations';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {ArrayUtils} from 'src/app/util/array-utils';
import {UserService} from 'src/app/user.service';
import {FormArray, FormControl} from '@angular/forms';
import {Collapse} from 'bootstrap';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'app-ongeki-card-gallery',
  templateUrl: './ongeki-card-gallery.component.html',
  styleUrls: ['./ongeki-card-gallery.component.css'],
  inputs: ['isModal', 'callback', 'showDummyCard'],
  animations: [
    trigger('cardAnimation', [
      state('normal', style({
        transform: 'scale(1)',
        position: 'static',
        zIndex: 'auto',
        width: '*',
        height: '*',
        top: '*',
        left: '*'
      })),
      state('expanded', style({
        transform: 'translate(-50%, -50%) translateZ(10000px)',
        position: 'fixed',
        width: '{{expandedWidth}}px',
        height: '{{expandedHeight}}px',
        top: '50%',
        left: '50%',
        zIndex: 1100
      }), {params: {expandedWidth: '182.233', expandedHeight: '259.683'}}),
      transition('* => expanded', [
        style({
          transform: 'translate(-50%, -50%)',
          position: 'fixed',
          width: '{{width}}px',
          height: '{{height}}px',
          top: '{{top}}px',
          left: '{{left}}px',
          zIndex: 1100
        }),
        animate('1s ease-in-out')
      ]),
      transition('expanded => normal', [
        animate('1s ease-in-out', style({
          transform: 'translate(-50%, -50%)',
          position: 'fixed',
          width: '{{width}}px',
          height: '{{height}}px',
          top: '{{top}}px',
          left: '{{left}}px',
          zIndex: 1100
        }))
      ])
    ])
  ]
})
export class OngekiCardGalleryComponent implements OnInit {
  isModal = false;
  callback: (cardID: number) => void;
  showDummyCard = false;

  attrs = ['Fire', 'Leaf', 'Aqua'];
  rarities = ['SSR', 'SRPlus', 'SR', 'R', 'N'];
  skillCategorys = ['Attack', 'Boost', 'Guard', 'Support', 'DangerAttack', 'DangerBoost', 'DangerGuard', 'DangerSupport'];
  protected readonly Math = Math;

  host = environment.assetsHost;
  enableImages = environment.enableImages;
  holoSheetStyles: string[] = [];
  reversedHoloSheetStyles: string[] = [];

  filterCollapsed = true;
  filterCollapse: Collapse;

  allCards: OngekiCard[];
  allSkills: OngekiSkill[];
  cardIds: number[];
  filteredIds: number[];
  cardList: Observable<PlayerCard[]>;
  loading = true;
  isSafari = false;
  currentPage = 1;
  totalElements = 0;

  showHolo = false;
  showElements = true;
  sortControl = new FormControl('0');
  showAllControl = new FormControl(true);
  rarityControls = new FormArray([]);
  attrControls = new FormArray([]);
  skillCategoryControls = new FormArray([]);
  searchTermControl = new FormControl('');
  pickingCard = false;
  pickedCardId: number = null;
  pickCardParams: {
    left: number;
    top: number;
    width: number;
    height: number;
    expandedWidth: number;
    expandedHeight: number;
  } = {
    left: null,
    top: null,
    width: null,
    height: null,
    expandedWidth: null,
    expandedHeight: null
  };
  private pickedCardParent: HTMLElement;

  private pageSubject = new ReplaySubject<number>();
  pageObservable = this.pageSubject.asObservable();

  constructor(
    private api: ApiService,
    public route: ActivatedRoute,
    private userService: UserService,
    private messageService: MessageService,
    private dbService: NgxIndexedDBService,
    public router: Router,
    private modalService: NgbModal,
    private translateService: TranslateService
  ) {
    const userAgent = window.navigator.userAgent;
    const safari = userAgent.indexOf('Safari') > -1;
    const chrome = userAgent.indexOf('Chrome') > -1;
    this.isSafari = safari && !chrome;

    this.attrs.forEach(() => this.attrControls.push(new FormControl(false)));
    this.rarities.forEach(() => this.rarityControls.push(new FormControl(false)));
    this.skillCategorys.forEach(() => this.skillCategoryControls.push(new FormControl(false)));
  }

  async ngOnInit() {
    await this.prepare();
    this.route.queryParams.subscribe(param => {
      if (param.page && !this.isModal){
        this.pageSubject.next(param.page);
      }
    });
    combineLatest([
      this.pageSubject.pipe(startWith(1)),
      this.sortControl.valueChanges.pipe(startWith(this.sortControl.value)),
      this.showAllControl.valueChanges.pipe(startWith(this.showAllControl.value)),
      this.rarityControls.valueChanges.pipe(startWith(this.rarityControls.value)),
      this.attrControls.valueChanges.pipe(startWith(this.attrControls.value)),
      this.skillCategoryControls.valueChanges.pipe(startWith(this.skillCategoryControls.value)),
      this.searchTermControl.valueChanges.pipe(startWith(this.searchTermControl.value)),
    ]).subscribe(([page, sort, showAll, raritiesValues, attrValues, skillCategoryValues, searchTerm]) => {
      const selectedAttrs = this.attrs.filter((_, index) => attrValues[index]);
      const selectedSkillCategorys = this.skillCategorys.filter((_, index) => skillCategoryValues[index]);
      const selectedrarities = this.rarities.filter((_, index) => raritiesValues[index]);
      this.filteredIds = this.filterCard(showAll, sort, selectedrarities, selectedAttrs, selectedSkillCategorys, searchTerm);

      if (this.showDummyCard) {
        this.filteredIds = [0, ...this.filteredIds];
      }

      this.totalElements = this.filteredIds.length;
      this.currentPage = page;
      this.load(this.currentPage);
    });
    if (this.isSafari) {
      this.translateService.get('Ongeki.CardGallery.SafariWarning').subscribe(x => {
        this.messageService.notice(x, 'warning');
      });
    }
  }


  pickCard(cardId: number, cardCol: HTMLDivElement): void {
    if (this.pickingCard || this.isSafari) {
      return;
    }
    if (!this.cardIds.includes(cardId)) {
      return;
    }
    if (this.pickedCardId) {
      this.onMouseLeaveCard(cardCol);
      return this.unpickCard();
    }
    const rect = cardCol.getBoundingClientRect();
    this.pickCardParams.width = rect.width;
    this.pickCardParams.height = rect.height;
    this.pickCardParams.left = (rect.right + rect.left) / 2;
    this.pickCardParams.top = (rect.bottom + rect.top) / 2;

    let maxWidth = this.Math.min(window.innerHeight * 0.730038022813688, window.innerWidth);
    maxWidth *= 0.9;
    maxWidth = this.Math.min(maxWidth, 768);
    const maxHeight = maxWidth / 0.730038022813688;
    this.pickCardParams.expandedWidth = maxWidth;
    this.pickCardParams.expandedHeight = maxHeight;


    this.onMouseLeaveCard(cardCol);
    cardCol.classList.add('card-picking');
    this.pickedCardId = cardId;
    this.pickedCardParent = cardCol.parentElement;
    document.querySelector('body').classList.add('overflow-hidden');
  }

  unpickCard() {
    const rect = this.pickedCardParent.getBoundingClientRect();
    this.pickCardParams.width = rect.width;
    this.pickCardParams.height = rect.height;
    this.pickCardParams.left = (rect.right + rect.left) / 2;
    this.pickCardParams.top = (rect.bottom + rect.top) / 2;

    this.pickedCardId = null;
  }

  onPickAnimationStart(cardCol: HTMLDivElement) {
    this.pickingCard = true;
    cardCol.style.setProperty('--rotator-transition', 'all 1s ease-out');
  }

  onPickAnimationEnd(cardCol: HTMLDivElement) {
    this.pickingCard = false;
    cardCol.style.removeProperty('--rotator-transition');
    if (!this.pickedCardId) {
      document.querySelector('body').classList.remove('overflow-hidden');
    }
  }

  onMoveRotator(clientX: number, clientY: number, cardCol: HTMLDivElement) {
    if (this.isSafari) {
      return;
    }
    const rect = cardCol.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (centerY - y) / (rect.width / 32);
    const rotateY = (x - centerX) / (rect.height / 32);

    cardCol.style.setProperty('--rotator-rotate-x', `${rotateX}deg`);
    cardCol.style.setProperty('--rotator-rotate-y', `${rotateY}deg`);

    const max = Math.sqrt(centerX * centerX + centerY * centerY);
    const dx = (x - centerX) / max;
    const dy = (y - centerY) / max;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const pseudoLeft = (x / rect.width) * 100 + '%';
    const pseudoTop = (y / rect.height) * 100 + '%';
    cardCol.style.setProperty('--rotator-transition', 'all 0s ease-out');
    cardCol.style.setProperty('--pseudo-left', pseudoLeft.toString());
    cardCol.style.setProperty('--pseudo-top', pseudoTop.toString());
    cardCol.style.setProperty('--pseudo-opacity', Math.min(1, distance).toString());
  }

  onTouchMoveRotator(event: TouchEvent, cardCol: HTMLDivElement) {
    if (!this.pickedCardId || this.pickingCard) {
      return;
    }
    const touch = event.touches[0];
    let clientX = touch.clientX;
    let clientY = touch.clientY;
    const rect = cardCol.getBoundingClientRect();
    if (clientX < rect.left) {
      clientX = rect.left;
    } else if (clientX > rect.right) {
      clientX = rect.right;
    } else if (clientY < rect.top) {
      clientY = rect.top;
    } else if (clientY > rect.bottom) {
      clientY = rect.bottom;
    }
    this.onMoveRotator(clientX, clientY, cardCol);
    event.preventDefault();
  }

  onMouseMoveRotator(event: MouseEvent, cardRotator: HTMLDivElement): void {
    if (this.pickingCard) {
      return;
    }
    this.onMoveRotator(event.clientX, event.clientY, cardRotator);
  }

  onMouseLeaveCard(cardCol: HTMLDivElement): void {
    if (this.isSafari) {
      return;
    }

    cardCol.style.removeProperty('--rotator-rotate-x');
    cardCol.style.removeProperty('--rotator-rotate-y');

    cardCol.style.removeProperty('--rotator-transition');
    cardCol.style.setProperty('--pseudo-left', '50%');
    cardCol.style.setProperty('--pseudo-top', '50%');
    cardCol.style.setProperty('--pseudo-opacity', '0');
  }

  async prepare() {
    const dummyCard: any = {id: 0};
    this.allCards = [dummyCard, ...await lastValueFrom(this.dbService.getAll<OngekiCard>('ongekiCard'))];
    this.allSkills = await lastValueFrom(this.dbService.getAll<OngekiSkill>('ongekiSkill'));
    this.cardIds = (await lastValueFrom(this.api.get('api/game/ongeki/cardIds')));
  }

  filterCard(
    showAll: boolean,
    sort: string,
    selectedRarities,
    selectedAttrs: string[],
    selectedSkillCategories: string[],
    searchTerm: string) {
    let filteredIds;
    if (this.isModal) {
      showAll = false;
    }
    if (showAll && sort === '0') {
      const unAcquiredCards = this.allCards.filter(card => !this.cardIds.includes(card.id)).map(card => card.id);
      filteredIds = this.cardIds.concat(unAcquiredCards);
    } else if (showAll && sort === '1') {
      filteredIds = this.allCards.map(card => card.id);
    } else if (!showAll && sort === '1') {
      filteredIds = this.allCards.filter(card => this.cardIds.includes(card.id)).map(card => card.id);
    } else if (!showAll && sort === '0') {
      filteredIds = this.cardIds;
    }

    if (selectedRarities.length > 0 && selectedRarities.length < this.rarities.length) {
      const filteredCard = this.allCards.filter(card => selectedRarities.includes(card.rarity)).map(card => card.id);
      filteredIds = filteredIds.filter(id => filteredCard.includes(id));
    }

    if (selectedAttrs.length > 0 && selectedAttrs.length < this.attrs.length) {
      const filteredCard = this.allCards.filter(card => selectedAttrs.includes(card.attribute)).map(card => card.id);
      filteredIds = filteredIds.filter(id => filteredCard.includes(id));
    }

    if (selectedSkillCategories.length > 0 && selectedSkillCategories.length < this.skillCategorys.length) {
      const filteredSkillId = this.allSkills.filter(skill => selectedSkillCategories.includes(skill.category)).map(skill => skill.id);
      const filteredCard = this.allCards.filter(card =>
        filteredSkillId.includes(card.skillId) ||
        filteredSkillId.includes(card.choKaikaSkillId)).map(card => card.id);
      filteredIds = filteredIds.filter(id => filteredCard.includes(id));
    }

    const terms = this.parseSearchTerms(searchTerm.toLowerCase());
    const filteredSkill = this.filterSkillByTerms(terms);
    filteredIds = filteredIds.filter(id => this.filterCardByTerms(id, terms, filteredSkill));


    return filteredIds;
  }

  private filterCardByTerms(id, terms: string[], skillIds: number[]) {
    const card = this.allCards.find(c => c.id === id);
    if (!card || card.id === 0) {
      return false;
    }
    const nickName = card.nickName.toLowerCase();
    const cardNumber = card.cardNumber.toLowerCase();
    const charaName = card.name.replace('【SR+】', '【SRPlus】').replace(`【${card.rarity}】`, '').replace(`[${nickName}]`, '').toLowerCase();
    return terms.every(term => {
      if (id === Number(term)) {
        return true;
      }
      if (nickName.includes(term)) {
        return true;
      }
      if (cardNumber === term) {
        return true;
      }
      if (charaName.includes(term)) {
        return true;
      }
      if (skillIds.includes(card.skillId) || skillIds.includes(card.choKaikaSkillId)) {
        return true;
      }
      return false;
    });
  }

  private filterSkillByTerms(terms: string[]) {
    return this.allSkills.filter(skill => {
      return terms.some(term => {
        if (skill.name.toLowerCase().includes(term)) {
          return true;
        }
        if (skill.info.toLowerCase().includes(term)) {
          return true;
        }
        return false;
      });
    }).map(skill => skill.id);
  }

  load(page: number) {
    const pageSize = 12;
    const start = Math.min((page - 1) * pageSize, this.filteredIds.length);
    const end = Math.min(start + pageSize, this.filteredIds.length);
    const pageIds = this.filteredIds.slice(start, end);
    const acquiredPageIds = pageIds.filter(id => this.cardIds.includes(id));
    const cardIdsParam = acquiredPageIds.join(',');
    const params = new HttpParams().set('cardIds', cardIdsParam);
    this.cardList = this.api.get('api/game/ongeki/cardInfos', params).pipe(
      tap(
        data => {
          this.currentPage = page;
        }
      ),
      map(
        data => {
          const content: PlayerCard[] = data;
          const cards = pageIds.map(id => {
            let playerCard: PlayerCard = content.find(card => card.cardId === id);
            if (!playerCard) {
              const card = this.allCards.find(c => c.id === id);
              const maxLevel = card.rarity === 'N' ? 100 : 70;
              playerCard = {
                cardId: id,
                digitalStock: 0,
                analogStock: 0,
                level: maxLevel,
                maxLevel,
                exp: 0,
                printCount: 0,
                useCount: 0,
                kaikaDate: '2000-00-00 00:00:00.0',
                choKaikaDate: '2000-00-00 00:00:00.0',
                skillId: card?.choKaikaSkillId,
                created: '0000-00-00 00:00:00.0',
                isNew: false,
                isAcquired: false
              };
            }
            return playerCard;
          });

          cards.forEach(x => {
            if (x.cardId === 0) { return; }
            this.dbService.getByID<OngekiCard>('ongekiCard', x.cardId).subscribe(
              y => {
                x.cardInfo = y;
                this.dbService.getByID<OngekiCharacter>('ongekiCharacter', y.charaId).subscribe(
                  z =>
                    x.characterInfo = z
                );
                if (x.choKaikaDate !== '0000-00-00 00:00:00.0') {
                  this.dbService.getByID<OngekiSkill>('ongekiSkill', y.choKaikaSkillId).subscribe(
                    z => x.skillInfo = z
                  );
                } else {
                  this.dbService.getByID<OngekiSkill>('ongekiSkill', y.skillId).subscribe(
                    z => x.skillInfo = z
                  );
                }
              }
            );
          });
          this.loading = false;
          this.holoSheetStyles = this.generateShuffledHoloSheetStyles();
          this.reversedHoloSheetStyles = this.holoSheetStyles.reverse();
          return cards;
        },
        error => this.messageService.notice(error)
      )
    );
  }

  kaika(cardId: number, type: string) {
    const aimeId = String(this.userService.currentUser.defaultCard.extId);
    const param = new HttpParams().set('aimeId', aimeId);
    this.api.post('api/game/ongeki/card/' + cardId + '/' + type, param).subscribe(
      data => {
        this.messageService.notice('Kaika success');
        this.load(this.currentPage);
      },
      error => this.messageService.notice(error)
    );
  }

  insertCard(cardId: number) {
    const aimeId = this.userService.currentUser.defaultCard.extId;
    this.api.post('api/game/ongeki/card', {
      aimeId,
      cardId
    }).subscribe(
      data => {
        this.messageService.notice('Successful, go to check your card list');
        this.cardIds = [cardId].concat(this.cardIds);
        this.load(this.currentPage);
      },
      error => this.messageService.notice(error)
    );
  }

  pageChanged(page: number) {
    if (this.isModal) {
      this.pageSubject.next(page);
    } else {
      this.router.navigate(['ongeki/card/gallery'], {queryParams: {page}});
    }
  }

  calculateAtk(level: number, levelParams: number[], isChokaika: boolean): number {
    if (levelParams === null) {
      return null;
    }
    if (isChokaika) {
      return levelParams[levelParams.length - 1];
    }

    const levels = [1, 50, 55, 60, 65, 70, 80, 90, 100];

    if (level < levels[0]) {
      level = 1;
    } else if (level > levels[levels.length - 4]) {
      level = levels[levels.length - 4];
    }

    for (let i = 0; i < levels.length - 1; i++) {
      if (level >= levels[i] && level < levels[i + 1]) {
        const diff = levels[i + 1] - levels[i];
        const ratio = (level - levels[i]) / diff;
        const atkDiff = levelParams[i + 1] - levelParams[i];
        return Math.floor(levelParams[i] + ratio * atkDiff);
      }
    }

    throw new Error('Level not found in range');
  }

  convertToNumberArray(input: string): number[] {
    if (input === null) {
      return null;
    }
    return input.split(',').map(str => parseFloat(str.trim()));
  }

  getCardName(str: string, rarity: string, nickName: string): string {
    if (str) {
      return str.replace('【SR+】', '【SRPlus】').replace(`【${rarity}】`, '').replace(`[${nickName}]`, '');
    }
  }

  openContext($event: MouseEvent, content: TemplateRef<any>) {
    if (this.pickedCardId) {
      return;
    }
    this.modalService.open(content, {centered: true});
    $event.preventDefault();
  }

  generateShuffledHoloSheetStyles(): string[] {
    const styles = [];
    for (let i = 0; i < 12; i++) {
      const index = i.toString().padStart(2, '0');
      styles.push(this.getHoloSheetStyle(index));
    }
    return ArrayUtils.shuffleArray(styles);
  }

  getHoloSheetStyle(index: string) {
    return `--holo-sheet-bottom: url("${this.host}assets/holo-sheet/${index}/bottom.webp");
      --holo-sheet-middle: url("${this.host}assets/holo-sheet/${index}/middle.webp");
      --holo-sheet-top: url("${this.host}assets/holo-sheet/${index}/top.webp");`;
  }

  resetFilter() {
    this.showAllControl.setValue(true);
    this.attrControls.controls.forEach(c => c.setValue(false));
    this.skillCategoryControls.controls.forEach(c => c.setValue(false));
    this.sortControl.setValue('0');
    this.rarityControls.controls.forEach(c => c.setValue(false));
    this.searchTermControl.setValue('');
  }

  isDefaultFilter() {
    return this.showAllControl.value === true &&
      this.attrControls.controls.every(c => c.value === false) &&
      this.skillCategoryControls.controls.every(c => c.value === false) &&
      this.sortControl.value === '0' &&
      this.rarityControls.controls.every(c => c.value === false) &&
      this.searchTermControl.value === '';
  }

  toggleFilter() {
    if (!this.filterCollapse) {
      const collapseElement = document.getElementById('filterCollapse');
      if (collapseElement) {
        this.filterCollapse = new Collapse(collapseElement, {toggle: false});
      }
    }
    if (this.filterCollapsed) {
      this.filterCollapse.show();
      this.filterCollapsed = false;
    } else {
      this.filterCollapse.hide();
      this.filterCollapsed = true;
    }
  }

  parseSearchTerms(searchTerm: string): string[] {
    const terms: string[] = [];
    let buffer = '';
    let inQuotes = false;
    let escapeNext = false;

    for (const char of searchTerm) {
      if (escapeNext) {
        buffer += char;
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"') {
        if (!inQuotes && buffer.length > 0) {
          terms.push(buffer.trim());
          buffer = '';
        }
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (buffer.length > 0) {
          terms.push(buffer);
          buffer = '';
        }
      } else {
        buffer += char;
      }
    }

    if (buffer.length > 0) {
      terms.push(buffer.trim());
    }

    return terms;
  }

  toDisplayRarity(rarity: string) {
    if (rarity === 'SRPlus') {
      return 'SR+';
    }
    return rarity;
  }

  toDisplaySkillCategory(skillCategory: string) {
    if (skillCategory === 'Support') {
      return 'Assist';
    } else if (skillCategory === 'DangerSupport') {
      return 'DangerAssist';
    }
    return skillCategory;
  }
}
