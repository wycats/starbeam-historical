The first React example:

```tsx
export function CurrentDate() {
  return <div>{new Date().toLocaleDateString()}</div>;
}
```

Make it reactive:

```tsx
export function CurrentDate() {
  const [date, setDate] = useState(new Date());

  return (
    <>
      <button onClick={() => setDate(new Date())}>🔃</button>
      <div>{date.toLocaleDateString()}</div>
    </>
  );
}
```

Switch to Starbeam:

```tsx
export function CurrentDate() {
  const date = reactive({ now: new Date() });

  return (
    <>
      <button onClick={() => (date.now = new Date())}>🔃</button>
      <div>{String(date.now)}</div>
    </>
  );
}
```

Let's localize it:

```tsx
export function CurrentDate() {
  const date = reactive({ now: new Date() });

  return (
    <>
      <button onClick={() => date.now = new Date()}>🔃</button>
      <div>{new Intl.DateTimeFormat(undefined, { todo: ... }).format(date.now)}</div>
    </>
  );
}
```

Let's make the locale reactive:

```tsx
export function CurrentDate() {
  const date = reactive({ now: new Date(), locale: Intl.DateTimeFormat().resolvedOptions().locale });
  const form = ref(HTMLFormElement);

  function update() {
    date.now = new Date();
    date.locale = null; // todo
  }

  return (
    <>
      <form onInput={update} ref={form}>
        <button onClick={() => date.now = new Date()}>🔃</button>
        <select>
        </select>
      </form>
      <div>{new Intl.DateTimeFormat(date.locale, { todo: ... }).format(date.now)}</div>
    </>
  );
}
```

Let's refactor this into a class:

```tsx
class FormattedDate {
  @reactive now = new Date();
  @reactive locale = Intl.DateTimeFormat().resolvedOptions().locale;

  refresh() {
    this.now = new Date();
  }

  get format() {
    return new Intl.DateTimeFormat(this.locale, {
      /* TODO */
    }).format(this.now);
  }
}

// To bridge Starbeam's reactivity world to the hooks world, we use the useReactive hook

export function CurrentDate() {
  const date = new FormattedDate();
  const format = useReactive(() => date.format);

  return (
    <>
      <button onClick={date.refresh()}>🔃</button>
      <div>{format}</div>
    </>
  );
}
```

You can also wrap the entire component in useReactive:

```tsx
export function CurrentDate() {
  return useReactive(() => {
    const date = new FormattedDate();

    return (
      <>
        <button onClick={date.refresh()}>🔃</button>
        <div>{date.format}</div>
      </>
    );
  });
}
```

Let's make FormattedDate more elaborate:

```tsx
class FormattedDate {
  @reactive now = new Date();
  @reactive locale = Intl.DateTimeFormat().resolvedOptions().locale;

  refresh() {
    this.now = new Date();
  }

  get format() {
    return new Intl.DateTimeFormat(this.locale, {
      /* TODO */
    }).format(this.now);
  }
}
```

It works in React still!

Let's allow the user to control more of the options:

> TODO: update the code to use more of a form and use the form's onInput event to update the FormattedDate

It works in Svelte!

> Quick Demo

Make it a resource so it can tick:

```tsx
const Clock = Resource((resource) => {
  const date = new FormattedDate();

  const interval = setInterval(() => {
    date.now = new Date();
  }, 1000);

  resource.on.cleanup(() => clearInterval(interval));

  return date;
});
```

Use it in React:

```tsx
export function CurrentDate() {
  return useReactive((component) => {
    const clock = component.use(Clock);

    return (
      <>
        <button onClick={clock.refresh()}>🔃</button>
        <div>{clock.format}</div>
      </>
    );
  });
}
```

It works in Svelte:

```svelte
<script>
  import { use } from "@starbeam/svelte";

  // this is a normal Svelte store
  const clock = use(Clock);
</script>

<button on:click={$clock.refresh()}>🔃</button>
<div>{$clock.format}</div>
```

Add another feature:

> Add another feature to the Starbeam universal code and wire it up to React and Svelte

## Closing Points

- "It's Just JS"
- You can use it in your app
- You can also use it to build universal reactive libraries that work in any framework
- Status: "#VeryAlpha"
- Vision/Aspiration/Roadmap

# Appendix: Using Hooks

What would it look like using hooks?

```tsx
function useFormattedDate(
  locale = Intl.DateTimeFormat().resolvedOptions().locale
) {
  const [now, setNow] = useState(new Date());

  function refresh() {
    setNow(new Date());
  }

  return {
    refresh,
    format: new Intl.DateTimeFormat(locale, {
      /* TODO */
    }).format(now),
  };
}
```
