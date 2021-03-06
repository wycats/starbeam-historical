import type * as browser from "@domtree/browser";
import type * as minimal from "@domtree/minimal";
import type * as dom from "@domtree/interface";
export declare type Document = browser.Document | minimal.Document;
export declare type Text = browser.Text | minimal.Text;
export declare type Comment = browser.Comment | minimal.Comment;
export declare type DocumentFragment = browser.DocumentFragment | minimal.DocumentFragment;
export declare type Element = browser.Element | minimal.Element;
export declare type TemplateElement = browser.TemplateElement | minimal.TemplateElement;
export declare type StaticRange = browser.StaticRange | minimal.StaticRange;
export declare type StaticRangeOptions = browser.StaticRangeOptions | minimal.StaticRangeOptions;
export declare type LiveRange = browser.LiveRange | minimal.LiveRange;
export declare type Attr = browser.Attr | minimal.Attr;
export declare type DomTree = dom.Impl<{
    Node: Node;
    Document: Document;
    DocumentType: DocumentType;
    DocumentFragment: DocumentFragment;
    Text: Text;
    Comment: Comment;
    Element: Element;
    TemplateElement: TemplateElement;
    Attr: Attr;
    StaticRange: StaticRange;
    LiveRange: LiveRange;
}>;
export declare type CharacterData = minimal.CharacterData | browser.CharacterData;
export declare type ParentNode = minimal.ParentNode | browser.ParentNode;
export declare type ChildNode = minimal.ChildNode | browser.ChildNode;
export declare type Node = minimal.Node | browser.Node;
export declare type Minimal<N extends Node | LiveRange | StaticRange> = N extends minimal.Node | minimal.LiveRange | minimal.StaticRange ? N : N extends LiveRange ? minimal.LiveRange : N extends StaticRange ? minimal.StaticRange : N extends Document ? minimal.Document : N extends DocumentType ? minimal.DocumentType : N extends DocumentFragment ? minimal.DocumentFragment : N extends Text ? minimal.Text : N extends Comment ? minimal.Comment : N extends Element ? minimal.Element : N extends TemplateElement ? minimal.TemplateElement : N extends Attr ? minimal.Attr : N extends StaticRange ? minimal.StaticRange : N extends LiveRange ? minimal.LiveRange : never;
//# sourceMappingURL=index.d.ts.map