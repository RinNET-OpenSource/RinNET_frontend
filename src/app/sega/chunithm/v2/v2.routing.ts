import {RouterModule, Routes} from '@angular/router';
import {V2ProfileComponent} from './v2-profile/v2-profile.component';
import {V2RatingComponent} from './v2-rating/v2-rating.component';
import {V2RecentComponent} from './v2-recent/v2-recent.component';
import {V2SettingComponent} from './v2-setting/v2-setting.component';
import {V2SonglistComponent} from './v2-songlist/v2-songlist.component';
import {V2CharacterComponent} from './v2-character/v2-character.component';
import {V2SongDetailComponent} from './v2-song-detail/v2-song-detail.component';
import {V2SongPlaylogComponent} from './v2-song-playlog/v2-song-playlog.component';
import {V2UserBoxComponent} from './v2-userbox/v2-userbox.component';
import {V2UserRankingComponent} from './v2-user-ranking/v2-user-ranking.component';
import {V2PcRankingComponent} from './v2-pc-ranking/v2-pc-ranking.component';
import {V2SongScoreRankingComponent} from './v2-song-score-ranking/v2-song-score-ranking.component';
import {V2RivalListComponent} from './v2-rival-list/v2-rival-list.component';

const routes: Routes = [
  {path: 'profile', component: V2ProfileComponent},
  {path: 'rating', component: V2RatingComponent},
  {path: 'recent', component: V2RecentComponent},
  {path: 'song', component: V2SonglistComponent},
  {path: 'song/:id', component: V2SongDetailComponent},
  {path: 'song/:id/:level', component: V2SongPlaylogComponent},
  {path: 'character', component: V2CharacterComponent},
  {path: 'rival', component: V2RivalListComponent},
  {path: 'userRanking', component: V2UserRankingComponent},
  {path: 'pcRanking', component:  V2PcRankingComponent},
  {path: 'setting', component: V2SettingComponent},
  {path: 'userbox', component: V2UserBoxComponent},
  {path: 'song/ranking/:id/:level', component: V2SongScoreRankingComponent},
];

export const V2Routes = RouterModule.forChild(routes);
