import type { SimpleElement, SimpleNode } from "@simple-dom/interface";
import { nodeName, type NodeTypePattern } from "./node.js";
import {
  Described,
  type IntoDescribed,
  type Pattern,
  PatternMatch,
  PatternMismatch,
  type PatternResult,
} from "../../expect.js";
import {
  type PatternDetails,
  Success,
  type Failure,
  Mismatch,
  Multiple,
  ValueDescription,
  type ChildFailure,
} from "../../report.js";
import zip from "lodash.zip";

export interface SimpleElementPatternOptions {
  tagName?: string;
  attributes?: Record<string, string | null>;
  children?: readonly NodeTypePattern<SimpleNode>[];
}

export interface MissingNode {
  type: "missing-node";
  expected: NodePattern;
}

function MissingNode(expected: NodePattern): MissingNode {
  return { type: "missing-node", expected };
}

export interface ExtraNode {
  type: "extra-node";
  node: SimpleNode;
}

function ExtraNode(node: SimpleNode): ExtraNode {
  return {
    type: "extra-node",
    node,
  };
}

export interface WrongNodeType {
  type: "wrong-node-type";
  actual: number;
}

function WrongNodeType(actual: number): PatternMismatch<WrongNodeType> {
  return PatternMismatch({
    type: "wrong-node-type",
    actual,
  });
}

interface WrongElementDetails {
  type: "wrong-element-details";
  tagName?: DidntMatch<string, string>;
  attributes?: Readonly<
    Record<string, DidntMatch<string | null, string | null>>
  >;
  children?: readonly PatternResult<WrongNode>[];
}

function failuresForDetails(
  details: WrongElementDetails
): readonly ChildFailure<Failure>[] {
  let failures: ChildFailure<Failure>[] = [];

  let { tagName, attributes, children } = details;
  if (tagName) {
    failures.push(
      Mismatch({
        description: "the element's tag name",
        actual: ValueDescription(tagName.actual),
        expected: ValueDescription(tagName.expected),
      })
    );
  }

  if (attributes) {
    for (let [name, failure] of Object.entries(attributes)) {
      failures.push(
        Mismatch({
          description: `the ${name} attribute`,
          actual: ValueDescription(failure.actual),
          expected: ValueDescription(failure.expected),
        })
      );
    }
  }

  if (children) {
    throw Error("todo: children in failuresForDetails");
  }

  return failures;
}

type WrongNode = WrongNodeType | WrongElementDetails | MissingNode | ExtraNode;

class WrongDetailsBuilder {
  #tagName: DidntMatch<string, string> | undefined = undefined;
  #attributes:
    | Record<string, DidntMatch<string | null, string | null>>
    | undefined = undefined;
  #children: PatternResult<WrongNode>[] = [];

  verifyTagName(actual: string, expected: string): void {
    if (actual !== expected) {
      this.#tagName = { actual, expected };
    }
  }

  #getAttributes(): Record<string, DidntMatch<string | null, string | null>> {
    if (this.#attributes === undefined) {
      this.#attributes = {};
    }

    return this.#attributes;
  }

  verifyAttribute(
    name: string,
    actual: string | null,
    expected: string | null
  ): void {
    if (actual === expected) {
      return;
    }

    this.#getAttributes()[name] = { actual, expected };
  }

  verifyChildren(
    actual: IntoDescribed<SimpleElement>,
    expected: readonly NodePattern[]
  ): void {
    let described = Described.from(actual);
    let zipped = zip(described.value.childNodes, expected);

    for (let [actual, pattern] of zipped) {
      if (pattern === undefined && actual !== undefined) {
        this.#children.push(PatternMismatch(ExtraNode(actual)));
        continue;
      }

      if (pattern !== undefined && actual === undefined) {
        this.#children.push(PatternMismatch(MissingNode(pattern)));
        continue;
      }

      if (pattern !== undefined && actual !== undefined) {
        let result = pattern.check(
          Described.from(actual)
        ) as PatternResult<WrongNode>;
        this.#children.push(result);
      }

      if (pattern === undefined && actual === undefined) {
        throw Error(
          "unreachable: zip() yielded undefined for both values, and the arrays passed zip() cannot contain undefined"
        );
      }
    }
  }

  finalize(): PatternResult<WrongElementDetails> {
    let hasInvalidChildren = this.#children.some((c) => c.type === "mismatch");

    if (
      this.#tagName === undefined &&
      this.#attributes === undefined &&
      !hasInvalidChildren
    ) {
      return PatternMatch();
    } else {
      let failure: WrongElementDetails = {
        type: "wrong-element-details",
      };

      if (this.#tagName) {
        failure.tagName = this.#tagName;
      }

      if (this.#attributes) {
        failure.attributes = this.#attributes;
      }

      if (hasInvalidChildren) {
        failure.children = this.#children;
      }

      return PatternMismatch(failure);
    }
  }
}

type SimpleElementMismatch = WrongNodeType | WrongElementDetails;

type DidntMatch<Actual, Expected> = {
  expected: Expected;
  actual: Actual;
};

export class SimpleElementPattern
  implements Pattern<SimpleNode, SimpleElement, SimpleElementMismatch>
{
  readonly details: PatternDetails;

  constructor(
    readonly options: SimpleElementPatternOptions,
    scenario: string | undefined
  ) {
    this.details = {
      name: "isElement",
      description: options.tagName
        ? `is a <${options.tagName}>`
        : `is an element`,
      scenario,
    };
  }

  when(scenario: string): SimpleElementPattern {
    return new SimpleElementPattern(this.options, scenario);
  }

  check({
    value: node,
  }: Described<SimpleNode>): PatternResult<SimpleElementMismatch> {
    if (node.nodeType !== 1) {
      return WrongNodeType(node.nodeType);
    }

    let failure = new WrongDetailsBuilder();

    let { tagName, attributes, children } = this.options;

    if (tagName) {
      failure.verifyTagName(node.tagName.toLowerCase(), tagName.toLowerCase());
    }

    if (attributes) {
      for (let [name, expected] of Object.entries(attributes)) {
        failure.verifyAttribute(name, node.getAttribute(name), expected);
      }
    }

    if (children) {
      failure.verifyChildren(node, children);
    }

    let result = failure.finalize();

    if (result === null) {
      return PatternMatch();
    } else {
      return result;
    }
  }

  success(): Success {
    return Success({
      pattern: this.details,
      message: `the element matched`,
    });
  }

  failure(
    _actual: Described<SimpleElement>,
    failure: SimpleElementMismatch
  ): Failure {
    if (failure.type === "wrong-node-type") {
      return Mismatch({
        actual: ValueDescription(nodeName(failure.actual)),
        expected: ValueDescription(
          this.options.tagName ? `<${this.options.tagName}>` : `Element`
        ),
        pattern: this.details,
      });
    }

    return Multiple({
      message: `the element didn't match`,
      pattern: this.details,
      failures: failuresForDetails(failure),
    });
  }
}

type NodePattern = SimpleElementPattern | NodeTypePattern<SimpleNode>;
