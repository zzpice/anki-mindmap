import "./visual/original.css";
import "./style.css";
import { mount } from "./runtime";
export { current, dispose, mount } from "./runtime";
const host = document.getElementById("mm-react");
if (host) {
  try {
    mount(host);
  } catch (error) {
    console.error(
      "Mindmap: native content retained after startup failure",
      error,
    );
  }
}
