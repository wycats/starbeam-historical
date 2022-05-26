import { reactive } from "@starbeam/core";
import { Database } from "../src/database.js";
import { Contacts, People } from "./shared.js";

test("a foreign key", () => {
  const people = People.create();
  const contacts = Contacts.create();

  const db = Database.create().add(people).add(contacts);

  // create chirag
  const chirag = people.create("1", {
    name: "Chirag",
    location: "United States",
    contacts: reactive([]),
  });
});
