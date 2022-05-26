import { Formula } from "@starbeam/reactive";
import { attr, Model, Table } from "../index.js";

interface PersonColumns {
  name: string;
  location: string;
}

class Person extends Model<{
  name: "person";
  id: string;
  columns: PersonColumns;
  indexes: unknown;
}> {
  @attr name!: string;
  @attr location!: string;
}

test("An existing row", () => {
  const table = Table.define<PersonColumns>().named("people");

  const row = table.create("tomdale", {
    name: "tomdale",
    location: "Portland",
  });

  const card = Formula(() => {
    const { name, location } = row.columns;
    return `${name} (${location})`;
  });

  expect(row.columns).toMatchObject({ name: "tomdale", location: "Portland" });
  expect(card.current).toBe(`tomdale (Portland)`);

  const draft = row.draft;

  draft.mutate.name = "@tomdale";

  expect(row.columns).toMatchObject({ name: "tomdale", location: "Portland" });
  expect(card.current).toBe(`tomdale (Portland)`);

  draft.commit();

  expect(row.columns).toMatchObject({ name: "@tomdale", location: "Portland" });
  expect(card.current).toBe(`@tomdale (Portland)`);
});

test("Creating a new row", () => {});

export {};
