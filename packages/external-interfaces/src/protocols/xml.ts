import { validationOptionsOptional, X2jOptionsOptional, XMLParser as ExternalXMLParser } from "fast-xml-parser";

/**
 * @internal
 *
 * This interface represents the usage of the external dependency
 * and updates to that dependency should consider whether they will
 * maintain this contract.
 */
interface XMLParserExpectedInterface {
  parse(xmlData: string | Buffer, validationOptions?: validationOptionsOptional | boolean): any;
  addEntity(entityIndentifier: string, entityValue: string): void;
}

/**
 * @internal
 */
export const XMLParser: {
  new (options?: X2jOptionsOptional | undefined): XMLParserExpectedInterface;
} = ExternalXMLParser;
