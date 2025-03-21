import {Maimai2Music, Maimai2MusicDetails} from "./Maimai2Music";

export interface Maimai2Playlog {
    orderId: number;
    playlogId: number;
    songInfo: Maimai2Music;
    version: number;
    placeId: number;
    placeName: string;
    loginDate: number;
    playDate: string;
    userPlayDate: string;
    type: number;
    musicId: number;
    level: number;
    trackNo: number;
    vsMode: number;
    vsUserName: string;
    vsStatus: number;
    vsUserRating: number;
    vsUserAchievement: number;
    vsUserGradeRank: number;
    vsRank: number;
    playerNum: number;
    playedUserId1: number;
    playedUserName1: string;
    playedMusicLevel1: number;
    playedUserId2: number;
    playedUserName2: string;
    playedMusicLevel2: number;
    playedUserId3: number;
    playedUserName3: string;
    playedMusicLevel3: number;
    characterId1: number;
    characterLevel1: number;
    characterAwakening1: number;
    characterId2: number;
    characterLevel2: number;
    characterAwakening2: number;
    characterId3: number;
    characterLevel3: number;
    characterAwakening3: number;
    characterId4: number;
    characterLevel4: number;
    characterAwakening4: number;
    characterId5: number;
    characterLevel5: number;
    characterAwakening5: number;
    achievement: number;
    deluxscore: number;
    scoreRank: number;
    maxCombo: number;
    totalCombo: number;
    maxSync: number;
    totalSync: number;
    tapCriticalPerfect: number;
    tapPerfect: number;
    tapGreat: number;
    tapGood: number;
    tapMiss: number;
    holdCriticalPerfect: number;
    holdPerfect: number;
    holdGreat: number;
    holdGood: number;
    holdMiss: number;
    slideCriticalPerfect: number;
    slidePerfect: number;
    slideGreat: number;
    slideGood: number;
    slideMiss: number;
    touchCriticalPerfect: number;
    touchPerfect: number;
    touchGreat: number;
    touchGood: number;
    touchMiss: number;
    breakCriticalPerfect: number;
    breakPerfect: number;
    breakGreat: number;
    breakGood: number;
    breakMiss: number;
    isTap: boolean;
    isHold: boolean;
    isSlide: boolean;
    isTouch: boolean;
    isBreak: boolean;
    isCriticalDisp: boolean;
    isFastLateDisp: boolean;
    fastCount: number;
    lateCount: number;
    isAchieveNewRecord: boolean;
    isDeluxscoreNewRecord: boolean;
    comboStatus: number;
    syncStatus: number;
    isClear: boolean;
    beforeRating: number;
    afterRating: number;
    beforeGrade: number;
    afterGrade: number;
    afterGradeRank: number;
    beforeDeluxRating: number;
    afterDeluxRating: number;
    isPlayTutorial: boolean;
    isEventMode: boolean;
    isFreedomMode: boolean;
    playMode: number;
    isNewFree: boolean;
    trialPlayAchievement: number;
    extNum1: number;
    extNum2: number;
    extBool1: boolean;
    extBool2: boolean;
}
