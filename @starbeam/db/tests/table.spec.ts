import { Formula } from "@starbeam/reactive";
import { People } from "./shared.js";

test("creating a new row", () => {
  const people = People.create();

  const peopleList = Formula(() => {
    // create a comma-separated list of people by their names
    return [...people].map((person) => person.name).join(", ");
  });

  // Create a draft row.
  const chirag = people.create("1", {
    name: "Chirag",
    location: "United States",
    contacts: [],
  });

  // assert that the row has the right columns
  expect(chirag.columns).toMatchObject({
    name: "Chirag",
    location: "United States",
  });

  // assert that the table has the row.
  expect(people.has("1")).toBe(true);

  // assert that the list of people now contains the new person.
  expect(peopleList.current).toBe("Chirag");

  const melanie = people.create("2", {
    name: "Melanie",
    location: "United States",
    contacts: [],
  });

  // assert that the row has the right columns.
  expect(melanie.columns).toMatchObject({
    name: "Melanie",
    location: "United States",
  });

  // assert that the table has the row.
  expect(people.has("2")).toBe(true);

  /* assert that the list of people now contains the new person */
  expect(peopleList.current).toBe("Chirag, Melanie");
});

test("updating a row", () => {
  // Arrange: create a new table instance and add a new row.
  const people = People.create();

  const peopleList = Formula(() => {
    // create a comma-separated list of people by their names
    return [...people].map((row) => row.name).join(", ");
  });

  // Create a new row.
  const chirag = people.create("1", {
    name: "Chirag",
    location: "United States",
    contacts: [],
  });

  // assert that the list of people now contains the new person.
  expect(peopleList.current).toBe("Chirag");

  chirag.mutate.name = "Chirag Patel";

  // assert that the list of people is now updated with Chirag's new name.
  expect(peopleList.current).toBe("Chirag Patel");
});

test("delete a row", () => {
  // Arrange: create a new table instance and add a new row.
  const people = People.create();

  const peopleList = Formula(() => {
    // create a comma-separated list of people by their names
    return [...people].map((row) => row.name).join(", ");
  });

  const chirag = people.create("1", {
    name: "Chirag",
    location: "United States",
  });

  expect(peopleList.current).toBe("Chirag");

  // delete the row.
  people.delete(chirag);

  expect(peopleList.current).toBe("");
});
