import { Element, ElementOptions, Point } from "./base";
import { Constraint } from "./utils/constraint";

interface PaddingOptions
  extends Omit<ElementOptions, "children" | "x" | "y" | "width" | "height"> {
  padding?: number | [number, number, number, number];
  child: Element;
}

export class Padding extends Element implements PaddingOptions {
  type = "padding";
  padding: [number, number, number, number];
  child: Element;

  constructor(options: PaddingOptions) {
    super({
      ...options,
      children: [options.child]
    });
    this.padding = Array.isArray(options.padding)
      ? options.padding
      : options.padding === undefined
      ? [0, 0, 0, 0]
      : [options.padding, options.padding, options.padding, options.padding];
  }

  getWordPoint() {
    const rect = super.getWordPoint();
    const [top, right, bottom, left] = this.padding!;
    return {
      x: rect.x + left,
      y: rect.y + top
    };
  }

  layout() {
    const [top, right, bottom, left] = this.padding!;
    const rect = this.getLayoutRect();
    const gap = {
      width: left + right,
      height: top + bottom
    };
    this.children![0].constraint = rect.sub(gap);
    const childRect = this.children![0].layout();
    return new Constraint(childRect.width + left, rect.height + top);
  }
}
