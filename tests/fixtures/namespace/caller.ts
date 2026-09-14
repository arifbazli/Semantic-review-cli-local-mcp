import * as utils from "./utils";

class Worker {
  run() {
    return this.helper2();
  }

  helper2() {
    return utils.helper();
  }
}

export function main() {
  return utils.helper();
}
