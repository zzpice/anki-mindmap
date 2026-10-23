import "./visual/original.css";
import "./style.css";
export { current, dispose, mount } from "./runtime";
// The template loader mounts its own, still-connected host. Loading a bundle
// must never mount whichever card happens to be current when the request ends.
