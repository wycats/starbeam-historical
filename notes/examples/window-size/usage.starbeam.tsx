import { use } from "@starbeam/react";
import WindowSize from "./hook.starbeam.js";

function MyComponent() {
  let windowSize = use(WindowSize);
  // {
  //   innerWidth: window.innerWidth,
  //   innerHeight: window.innerHeight,
  //   outerWidth: window.outerWidth,
  //   outerHeight: window.outerHeight,
  // }

  // ...
}
