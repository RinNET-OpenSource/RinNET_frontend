import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatMenuModule} from '@angular/material/menu';
import {MatTableModule} from '@angular/material/table';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatSortModule} from '@angular/material/sort';
import {MatDialogModule} from '@angular/material/dialog';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {FlexLayoutModule} from '@angular/flex-layout';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatGridListModule} from '@angular/material/grid-list';
import {V2Routes} from './v2.routing';
import {V2ProfileComponent} from './v2-profile/v2-profile.component';
import {V2RatingComponent} from './v2-rating/v2-rating.component';
import {ToRatingPipe} from './util/to-rating.pipe';
import {RatingClass} from './util/rating-class.pipe';
import {CourceIdToClassPipe} from './util/cource-id-to-class.pipe';
import {V2RecentComponent} from './v2-recent/v2-recent.component';
import {ToRankPipe} from './util/to-rank.pipe';
import {V2SettingComponent} from './v2-setting/v2-setting.component';
import {V2NameSettingDialog} from './v2-setting/v2-name-setting/v2-name-setting.dialog';
import {V2VersionSettingDialog} from './v2-setting/v2-version-setting/v2-version-setting.dialog';
import {V2UserBoxSettingDialog} from './v2-userbox/v2-userbox-setting/v2-userbox-setting.dialog';
import {V2CharacterComponent} from './v2-character/v2-character.component';
import {V2SonglistComponent} from './v2-songlist/v2-songlist.component';
import {V2SongDetailComponent} from './v2-song-detail/v2-song-detail.component';
import {V2SongPlaylogComponent} from './v2-song-playlog/v2-song-playlog.component';
import {V2UserRankingComponent} from './v2-user-ranking/v2-user-ranking.component';
import {V2PcRankingComponent} from './v2-pc-ranking/v2-pc-ranking.component';
import {V2UserBoxComponent} from './v2-userbox/v2-userbox.component';
import {NgxPaginationModule} from 'ngx-pagination';
import {ToolsModule} from '../../../util/tools.module';
import {TranslateModule, TranslateLoader } from '@ngx-translate/core';
import {TranslateHttpLoader } from '@ngx-translate/http-loader';
import {HttpClient } from '@angular/common/http';
import { V2SongScoreRankingComponent } from './v2-song-score-ranking/v2-song-score-ranking.component';
import {NgIcon} from '@ng-icons/core';
import { V2RivalListComponent } from './v2-rival-list/v2-rival-list.component';

export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http);
  }

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    V2Routes,
    MatFormFieldModule,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatSnackBarModule,
    MatGridListModule,
    FlexLayoutModule,
    NgxPaginationModule,
    ToolsModule,
    TranslateModule.forChild({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    NgIcon
  ],
    declarations: [
        V2ProfileComponent,
        V2RatingComponent,
        ToRatingPipe,
        RatingClass,
        CourceIdToClassPipe,
        V2RecentComponent,
        ToRankPipe,
        V2SettingComponent,
        V2NameSettingDialog,
        V2VersionSettingDialog,
        V2CharacterComponent,
        V2SonglistComponent,
        V2SongDetailComponent,
        V2SongPlaylogComponent,
        V2UserBoxComponent,
        V2UserBoxSettingDialog,
        V2RatingComponent,
        V2UserRankingComponent,
        V2PcRankingComponent,
        V2SongScoreRankingComponent,
        V2RivalListComponent
    ]
})
export class V2Module {
}
