/** 与旧版 src/app/model/ApiResponse.ts、Page.ts、status-code.ts、user.service.ts 等价 */

export interface ApiResponse<T> {
  data: T;
  time: string;
  status: {
    code: number;
    message: string;
  };
}

export function isOk<T>(resp: ApiResponse<T> | null | undefined) {
  return resp?.status?.code === StatusCode.OK;
}

export interface Page<T> {
  content: T[];
  page: number;
  totalPages: number;
  totalElements: number;
}

export enum StatusCode {
  // Card Related, 10000-19999
  CARD_NOT_FOUND = 14041,
  REGISTER_NEW_CARD_SUCCESS = 12001,
  REGISTER_NEW_CARD_ERROR = 15001,
  SET_DEFAULT_CARD_SUCCESS = 12002,
  SET_DEFAULT_CARD_ERROR = 15002,
  REMOVE_CARD_EXTERNAL_SUCCESS = 12003,
  REMOVE_CARD_EXTERNAL_ERROR = 15003,
  CARD_EXTERNAL_NOT_FOUND = 14042,
  CARD_ALREADY_LINKED_BY_OTHERS = 14091,
  CARD_ALREADY_LINKED_BY_YOU = 14092,
  CARD_NOT_BELONG_TO_YOU = 94031,
  BIND_CARD_SUCCESS = 12004,
  BIND_CARD_ERROR = 15004,
  UNBIND_CARD_SUCCESS = 12005,
  UNBIND_CARD_ERROR = 15005,
  INVALID_ACCESS_CODE = 14001,
  ADD_ACCESS_CODE_SUCCESS = 12006,
  ADD_ACCESS_CODE_ERROR = 15006,
  CHANGE_ACCESS_CODE_SUCCESS = 12007,
  CHANGE_ACCESS_CODE_ERROR = 15007,

  // User Related, 20000-29999
  USER_NOT_FOUND = 24041,
  USER_FETCH_SUCCESS = 22001,

  // Auth Related, 30000-39999
  LOGIN_SUCCESS = 32001,
  LOGIN_FAILED = 34011,
  USERNAME_ALREADY_TAKEN = 34091,
  EMAIL_ALREADY_IN_USE = 34092,
  VERIFY_CODE_NOT_CORRECT = 34001,
  AUTH_INVALID_CREDENTIALS = 34011,
  USER_REGISTER_SUCCESS = 32011,
  VERIFY_CODE_SEND_SUCCESS = 32002,
  VERIFY_CODE_SEND_ERROR = 35001,
  VERIFY_CODE_SEND_TOO_FAST = 34291,
  RESET_PASSWORD_SUCCESS = 32003,
  RESET_PASSWORD_ERROR = 35002,
  RESET_PASSWORD_FAILED = 34002,

  // TOTP Related, 30000-39999
  TOTP_REQUIRED = 34014,
  TOTP_INVALID = 34015,
  TOTP_ALREADY_ENABLED = 34006,
  TOTP_NOT_ENABLED = 34007,
  TOTP_TOO_MANY_ATTEMPTS = 34292,
  PASSWORD_INCORRECT = 34016,
  ACCOUNT_BANNED = 34031,
  ACCOUNT_BAN_FORBIDDEN = 34032,
  EULA_REQUIRED = 34033,
  EULA_VERSION_INVALID = 34093,
  GAME_PROFILE_NOT_FOUND = 34044,
  GAME_PROFILE_STATE_INVALID = 34008,
  GAME_SAVE_DELETE_CONFIRMATION_INVALID = 34009,
  AUTH_CREDENTIAL_NOT_FOUND = 34045,
  EULA_DRAFT_NOT_FOUND = 34046,

  // OAuth Related, 30000-39999
  OAUTH_INVALID_CREDENTIALS = 34013,
  OAUTH_USER_NOT_REGISTERED = 34042,
  OAUTH_ALREADY_REGISTERED = 34005,

  RIVAL_NOTFOUND = 44041,
  RIVAL_SELF = 44001,
  RIVAL_LIMIT_REACHED = 44002,
  RIVAL_ALREADY_ADDED = 44003,

  // Global
  OK = 92001,
  UNAUTHORIZED = 94011,
  BAD_REQUEST = 94001,
  NOT_FOUND = 94041,
  METHOD_NOT_ALLOWED = 94051,
  INTERNAL_SERVER_ERROR = 95001,
}

export interface Role {
  id: number;
  name: string;
}

export interface CardExternal {
  id: number;
  luid: string;
}

export interface Card {
  id: number;
  extId: number;
  luid: string;
  registerTime: string;
  accessTime: string;
  cardExternalList: CardExternal[];
  default: boolean;
}

export interface SimpleUser {
  id: number;
  name: string;
}

export interface Keychip {
  id: number;
  keychipId: string;
  placeName: string;
  whiteListed: boolean;
  user: SimpleUser;
}

export interface KeychipDetail {
  id: number;
  keychipId: string;
  placeName: string;
  whiteListed: boolean;
  user: SimpleUser;
}

export interface UserTrustKeychip {
  id: number;
  userId: number;
  keychip: KeychipDetail;
}

export interface OAuth2 {
  id: number;
  provider: string;
  email: string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  roles: Role[];
  cards: Card[];
  defaultCard: Card;
  keychips: Keychip[];
  userTrustKeychips: UserTrustKeychip[];
  games: string[];
  oauth2s: OAuth2[];
}
