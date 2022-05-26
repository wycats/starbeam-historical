import { Formula } from "@starbeam/reactive";
import { People } from "./shared.js";

test("Creating a row", () => {
  const people = People.create();

  const row = people.create("tomdale", {
    name: "tomdale",
    location: "Portland",
    contacts: [],
  });

  const card = Formula(() => {
    const { name, location } = row.columns;
    return `${name} (${location})`;
  });

  expect(row.columns).toMatchObject({ name: "tomdale", location: "Portland" });
  expect(card.current).toBe(`tomdale (Portland)`);

  row.mutate.name = "@tomdale";

  expect(row.columns).toMatchObject({ name: "@tomdale", location: "Portland" });
  expect(card.current).toBe(`@tomdale (Portland)`);
});
