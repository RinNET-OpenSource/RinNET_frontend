/** 等价旧版 announcement.component.ts 的模型与枚举 */

export interface LocalAnnouncement {
  language: string;
  translatedTitle: string;
  translatedContent: string;
}

export enum AnnouncementStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DRAFT = 'DRAFT',
}

export enum AnnouncementType {
  GENERAL = 'GENERAL',
  MAINTENANCE = 'MAINTENANCE',
  UPDATE = 'UPDATE',
  EVENT = 'EVENT',
  TUTORIAL = 'TUTORIAL',
  OTHER = 'OTHER',
}

export class Announcement {
  id!: number;
  title = '';
  content = '';
  expirationDate!: Date;
  updatedAt!: Date;
  status!: AnnouncementStatus;
  type!: AnnouncementType;
  priority!: number;
  translations: LocalAnnouncement[] = [{ language: 'en', translatedTitle: '', translatedContent: '' }];

  static fromJSON(json: any): Announcement {
    const announcement = new Announcement();
    announcement.id = json.id;
    announcement.title = json.title;
    announcement.content = json.content;
    announcement.expirationDate = new Date(json.expirationDate);
    announcement.updatedAt = new Date(json.updatedAt);
    announcement.status = json.status;
    announcement.type = json.type;
    announcement.priority = json.priority;
    announcement.translations = json.translations;
    return announcement;
  }

  getLocalTitle(lang: string): string {
    const trans = this.translations?.find((t) => t.language === lang);
    return trans?.translatedTitle ?? this.title;
  }

  getLocalContent(lang: string): string {
    const trans = this.translations?.find((t) => t.language === lang);
    return trans?.translatedContent ?? this.content;
  }
}
