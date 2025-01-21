import { Root } from "./root";
import { Constraint, Size } from "./utils/constraint";
import { AnimationController, AnimationType, Tween } from "ac";
import { omit, pick } from "lodash-es";
import { EventManage, CanvasPointEvent, EventName } from "./utils/eventManage";
import { TypeFn } from "./types";
import { CalcAABB, calcRotateCorners, quickAABB } from "./utils/calc";
import { Scroll } from "./scroll/scroll";
import { Layer } from "./layer";
import { linkEl } from "./utils/helper";

export interface Point {
  x: number;
  y: number;
}

const NEED_LAYOUT_KYE = ["width", "height", "text"];
const NUMBER_KEY = [
  "width",
  "height",
  "x",
  "y",
  "rotate",
  "translateX",
  "translateY"
];

export interface ElementOptions {
  key?: string;
  x?: number;
  y?: number;
  display?: "block" | "inline";
  boxSizing?: "border-box" | "content-box";
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  radius?: number | [number, number, number, number];
  overflow?: "hidden" | "visible";
  translateX?: number;
  translateY?: number;
  rotate?: number;
  // position?: "static" | "absolute" | "relative";
  backgroundColor?: string;
  children?: Element[];
  child?: Element;
  margin?: [top: number, right: number, bottom: number, left: number];
  padding?: [top: number, right: number, bottom: number, left: number];
}

export class Element extends EventTarget {
  eventManage = new EventManage(this);
  root: Root;
  isDirty: boolean = false;
  type = "element";
  x = 0;
  y = 0;
  radius: number | [number, number, number, number] = 0;
  translateX = 0;
  translateY = 0;
  rotate = 0;
  margin = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  display: "block" | "inline" = "block";
  width?: number;
  height?: number;
  key?: string;
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  backgroundColor?: string;
  overflow: "hidden" | "visible" = "visible";
  children?: Element[];
  parent?: Element;
  layer: Layer
  isMounted = false;
  widthAuto = false;
  ac: AnimationController;
  // isBreak: boolean = false;
  //如果是container这种内部嵌套的组件
  //因为每次layout会对这些组件进行重建
  //所以这些组件不算是真实的，将会被标记true
  //主动代码new出来的才是false
  isInternal: boolean = false;
  declare parentOrSiblingPoint: Point;
  declare size: Size;
  _provideLocalCtx = {
    translateX: 0,
    translateY: 0,
    rotate: 0,
    overflowHideEl: undefined as Element | undefined,
    scrollEl: undefined as Element | undefined,
    backgroundColorEl: undefined as Element | undefined
  };

  constructor(option?: ElementOptions) {
    super();
    this.setOption(option);
    if (option?.child) {
      this.children = [option.child];
    } else if (option?.children) {
      this.children = option.children;
    }
  }

  setOption(option?: ElementOptions) {
    if (option) {
      this.key = option.key ?? this.key;
      this.width = option.width ?? this.width;
      this.height = option.height ?? this.height;
      this.maxWidth = option.maxWidth ?? this.maxWidth;
      this.maxHeight = option.maxHeight ?? this.maxHeight;
      this.minWidth = option.minWidth ?? this.minWidth;
      this.minHeight = option.minHeight ?? this.minHeight;
      this.backgroundColor = option.backgroundColor ?? this.backgroundColor;
      this.x = option.x ?? this.x;
      this.y = option.y ?? this.y;
      this.display = option.display ?? this.display;
      this.radius = option.radius ?? this.radius;
      this.overflow = option.overflow ?? this.overflow;
      this.translateX = option.translateX ?? this.translateX;
      this.translateY = option.translateY ?? this.translateY;
      this.rotate = option.rotate ?? this.rotate;
      // this.position = option.position ?? "static";

      this.margin = option.margin
        ? {
          top: option.margin[0],
          right: option.margin[1],
          bottom: option.margin[2],
          left: option.margin[3]
        }
        : this.margin;

      this.padding = option.padding
        ? {
          top: option.padding[0],
          right: option.padding[1],
          bottom: option.padding[2],
          left: option.padding[3]
        }
        : this.padding;
    }
  }

  provideLocalCtx(reset = true) {
    if (this._provideLocalCtx && reset !== true) {
      return this._provideLocalCtx;
    }
    const parentLocalCtx = (this.parent || this.layer)?._provideLocalCtx || {};
    // this._provideLocalCtx = Object.create({
    //   backgroundColor: parentLocalCtx.backgroundColor ?? this.backgroundColor
    // });
    // this._provideLocalCtx.translateX = this.translateX
    //   ? this.translateX + parentLocalCtx.translateX
    //   : parentLocalCtx.translateX;
    // this._provideLocalCtx.translateY = this.translateY
    //   ? this.translateY + parentLocalCtx.translateY
    //   : parentLocalCtx.translateY;
    // this._provideLocalCtx.rotate = this.rotate
    //   ? this.rotate + parentLocalCtx.rotate
    //   : parentLocalCtx.rotate;
    this._provideLocalCtx = {
      scrollEl: parentLocalCtx.scrollEl,
      overflowHideEl:
        parentLocalCtx.overflowHideEl ??
        (this.overflow === "hidden" ? this : undefined),
      backgroundColorEl: this.backgroundColor
        ? this
        : parentLocalCtx.backgroundColorEl,
      translateX: this.translateX
        ? this.translateX + parentLocalCtx.translateX
        : parentLocalCtx.translateX,
      translateY: this.translateY
        ? this.translateY + parentLocalCtx.translateY
        : parentLocalCtx.translateY,
      rotate: this.rotate
        ? this.rotate + parentLocalCtx.rotate
        : parentLocalCtx.rotate
    };
    return this._provideLocalCtx;
  }

  getWordPoint(parentPoint = this.parentOrSiblingPoint!): Point {
    return {
      x: parentPoint.x + this.margin.left,
      y: parentPoint.y
    };
  }

  getLocalPoint(point?: Point): Point {
    return {
      x: this.x + (point?.x ?? 0),
      y: this.y + (point?.y ?? 0) + this.margin.top
    };
  }

  previousSibling() {
    if (this.parent?.children) {
      const index = this.parent.children?.findIndex((c) => c === this)!;
      return this.parent.children?.[index - 1];
    }
  }

  getSiblings() {
    return this.parent?.children?.filter((v) => v !== this);
  }

  setAttributes<T extends ElementOptions>(attrs?: T) {
    // if (!attrs) {
    //   if (this.root.useDirtyRect && this.root.dirtyDebugRoot) {
    //     this.root.dirtys.add(this);
    //     this.root.dirtyRender();
    //   }
    //   return;
    // }
    const target = this;
    const notAnimateKeys = omit(attrs, NUMBER_KEY);
    this.setOption(notAnimateKeys);
    const isLayout = Object.keys(pick(attrs, NEED_LAYOUT_KYE)).length;
    const numberKeys = pick(attrs, NUMBER_KEY);
    const acKeys = Object.keys(numberKeys);

    const notAnimateAndNotLayout = !acKeys.length && !isLayout;

    // if (this.root.useDirtyRect && notAnimateAndNotLayout) {
    //   this.root.dirtys.add(this);
    //   this.root.dirtyRender();
    //   return;
    // }
    if (notAnimateAndNotLayout) {
      this.layer.render();
      return;
    }

    const size = this.size;
    const selfStart = {
      x: target.x,
      y: target.y,
      width: size.width,
      height: size.height,
      rotate: target.rotate
    };
    const ac = this.ac || this.layer.ac;
    const tween = new Tween(pick(selfStart, acKeys), numberKeys)
      .animate(ac)
      .builder((value) => {
        this.setOption(value);
        this.layer.render();
      });

    ac.addEventListener(AnimationType.END, () => tween.destroy(), {
      once: true
    });
    ac.play();
  }

  appendChild(child: Element) {
    if (!this.children) {
      this.children = [];
    }
    linkEl(child, this)
    this.children.push(child);
    this.layer.render();
    child.mounted();
  }

  removeChild(child: Element) {
    if (!this.children) {
      return;
    }
    child.unmounted();
    this.children = this.children.filter((c) => c !== child);
    this.layer.render();
  }

  clearDirty() {
    if (this.isDirty) {
      const selfPoint = this.getLocalPoint(this.getWordPoint());
      const rect = this.size;
      const localCtx = this.provideLocalCtx();
      this.isDirty = false;
      this.layer.ctx.save();
      this.layer.ctx.clearRect(
        selfPoint.x + localCtx.translateX,
        selfPoint.y + localCtx.translateY,
        rect.width,
        rect.height
      );
      const backgroundColorEl =
        this.parent?.provideLocalCtx().backgroundColorEl;
      if (backgroundColorEl?.backgroundColor) {
        this.layer.ctx.fillStyle = backgroundColorEl?.backgroundColor;
        this.layer.ctx.fillRect(
          selfPoint.x + localCtx.translateX,
          selfPoint.y + localCtx.translateY,
          rect.width,
          rect.height
        );
      }
      this.layer.ctx.restore();
    }
  }

  layout(constraint: Constraint, isBreak = false): Size {
    const selfConstraint = constraint.extend(this);
    const childConstraint = selfConstraint.getChildConstraint(this);
    if (this.children?.length) {
      const rects = this.children!.map((child) => {
        linkEl(child, this)
        return child.layout(childConstraint);
      });
      const rect = rects.reduce(
        (prev, next) =>
        ({
          width: Math.max(prev.width, next.width),
          height: Math.max(prev.height, next.height)
        } as Size),
        new Size(this.width, this.height)
      );
      //允许子元素突破自己的尺寸
      this.size = isBreak ? rect : selfConstraint.compareSize(rect, this);
    } else {
      this.size = selfConstraint.compareSize(this, this);
    }
    return CalcAABB(this);
  }

  render(parentPoint: Point = this.parentOrSiblingPoint) {
    this.renderBefore(parentPoint);
    const point = this.getWordPoint();
    const selfPoint = this.getLocalPoint(point);
    // this.clearDirty();
    this.layer.ctx.save();
    this.draw(selfPoint);
    if (this.children?.length) {
      let childPoint = this.getPaddingPoint(selfPoint);
      this.children.forEach((child) => child.render(childPoint));
    }
    this.layer.ctx.restore();

    return point;
  }

  getPaddingPoint(p: Point) {
    return {
      x: p.x + this.padding.left,
      y: p.y + this.padding.top
    };
  }

  renderBefore(parentPoint: Point) {
    this.parentOrSiblingPoint = parentPoint;
    this.provideLocalCtx(true);
    return this;
  }

  draw(point: Point) {
    this.clearDirty();
    const size = this.size;
    this.layer.ctx.beginPath();
    const localCtx = this.provideLocalCtx();
    if (this.translateX || this.translateY) {
      this.layer.ctx.translate(this.translateX, this.translateY);
    }
    if (this.rotate) {
      const centerX = localCtx.translateX + point.x + size.width / 2;
      const centerY = localCtx.translateY + point.y + size.height / 2;
      this.layer.ctx.translate(centerX, centerY);
      this.layer.ctx.rotate(this.rotate * (Math.PI / 180));
      this.layer.ctx.translate(-centerX, -centerY);
    }
    if (this.backgroundColor) {
      this.layer.ctx.fillStyle = this.backgroundColor;
    }
    if (this.backgroundColor || this.overflow === "hidden") {
      // const roundRectPath = new Path2D();
      // roundRectPath.roundRect(50, 50, 200, 100, 20); // 圆角半径为 20
      this.layer.ctx.roundRect(
        point.x,
        point.y,
        size.width,
        size.height,
        this.radius
      );
    }
    if (this.backgroundColor) {
      this.layer.ctx.fill();
    }

    if (this.overflow === "hidden") {
      this.layer.ctx.clip();
    }
  }

  mounted() {
    if (this.children?.length) {
      const length = this.children.length - 1;
      for (let i = length; i >= 0; i--) {
        const child = this.children[i];
        child.mounted();
      }
    }
    if (!this.isMounted && !this.isInternal) {
      if (this.key) {
        this.root.keyMap.set(this.key, this);
      }
      this.root.quickElements.add(this);
      this.eventManage.mounted();
    }
    this.isMounted = true;
  }

  getBoundingBox() {
    const localMatrix = this.provideLocalCtx();
    if (!localMatrix.rotate) {
      return quickAABB(this);
    }

    //计算旋转之后的包围盒
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    calcRotateCorners(this).forEach((corner) => {
      if (corner.x < minX) minX = corner.x;
      if (corner.y < minY) minY = corner.y;
      if (corner.x > maxX) maxX = corner.x;
      if (corner.y > maxY) maxY = corner.y;
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  hasPointHint(x: number, y: number) {
    const localMatrix = this.provideLocalCtx();
    if (localMatrix.rotate) {
      const size = this.size;
      const point = this.getWordPoint();
      const selfPoint = this.getLocalPoint(point);
      const centerX = selfPoint.x + size.width / 2;
      const centerY = selfPoint.y + size.height / 2;
      const translatedX = x - centerX;
      const translatedY = y - centerY;
      const radians = (localMatrix.rotate * Math.PI) / 180;
      const cos = Math.cos(-radians);
      const sin = Math.sin(-radians);
      const localX = translatedX * cos - translatedY * sin;
      const localY = translatedX * sin + translatedY * cos;
      return (
        localX >= -size.width / 2 &&
        localX <= size.width / 2 &&
        localY >= -size.height / 2 &&
        localY <= size.height / 2
      );
    }
    const boxBound = quickAABB(this);
    const inX = x >= boxBound.x && x <= boxBound.width + boxBound.x;
    const inY = y >= boxBound.y && y <= boxBound.height + boxBound.y;
    return inX && inY;
  }

  hasInView() {
    const localMatrix = this.provideLocalCtx();
    const scrollEl = localMatrix.scrollEl as Scroll;
    if (scrollEl) {
      const boxBound = quickAABB(this);
      const scrollBox = scrollEl.getBoundingBox();
      const inX =
        boxBound.x < scrollBox.x + scrollBox.width &&
        boxBound.x + boxBound.width > scrollBox.x;
      const inY =
        boxBound.y < scrollBox.y + scrollBox.height &&
        boxBound.y + boxBound.height > scrollBox.y;
      return inX && inY;
    }
    return true;
  }

  unmounted() {
    if (this.key) {
      this.root.keyMap.delete(this.key);
    }
    this.root.quickElements.delete(this);
    this.parent = undefined;
    this.isMounted = false;
    this.eventManage.unmounted();
    if (this.children?.length) {
      this.children.forEach((child) => child.unmounted());
    }
  }

  //@ts-ignore
  addEventListener(
    type: EventName,
    callback: CanvasPointEvent,
    options?: AddEventListenerOptions | boolean
  ): void {
    this.eventManage.hasUserEvent = true;
    //@ts-ignore
    super.addEventListener(type, callback, options);
  }

  //@ts-ignore
  removeEventListener(
    type: EventName,
    callback: CanvasPointEvent,
    options?: AddEventListenerOptions | boolean
  ): void {
    //@ts-ignore
    super.removeEventListener(type, callback, options);
  }

  click = () => {
    this.eventManage.notify("click", {
      target: this,
      x: 0,
      y: 0,
      buttons: 0
    });
  };
}

export const element: TypeFn<ElementOptions, Element> = (
  option?: ElementOptions
) => {
  return new Element(option);
};

element.hFull = function (options: ElementOptions) {
  const g = element(options);
  g.height = Number.MAX_VALUE;
  return g;
};
