import { Table, type RowReference } from "../index.js";
import type { HasMany } from "../src/reference.js";

export interface Person {
  name: string;
  location: string;
  contacts: HasMany<{ name: "contacts"; columns: Contact }>[];
}

export interface Contact {
  service: string;
  username: string;
}

export interface Profile {
  bio: string;
  interests: string[];
}

export class People extends Table("people")<Person> {}
export class Contacts extends Table("contacts")<Contact> {}
export class Profiles extends Table("profiles")<Profile> {}
