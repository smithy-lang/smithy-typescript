import type { MemberShape, Model, Shape } from "../../model";
import { DeprecatedTrait, DocumentationTrait, InternalTrait, Prelude } from "../../model";
import type { DocumentedShape } from "../TypeScriptWriter";

/** Documentation view of a shape for TypeScriptWriter.writeShapeDocs. */
export function documentedShape(shape: Shape): DocumentedShape {
  return {
    getDocumentation: () => shape.getTrait(DocumentationTrait)?.getValue(),
    getDeprecation: () => shape.getTrait(DeprecatedTrait),
    isInternal: () => shape.hasTrait(InternalTrait),
  };
}

/** Documentation view of a member for TypeScriptWriter.writeMemberDocs, falling back to the target shape. */
export function documentedMember(model: Model, member: MemberShape): DocumentedShape {
  return {
    getDocumentation: () => member.getMemberTrait(model, DocumentationTrait)?.getValue(),
    getDeprecation: () => {
      const own = member.getTrait(DeprecatedTrait);
      if (own !== undefined) {
        return own;
      }
      const target = model.expectShape(member.getTarget());
      return Prelude.isPreludeShape(member.getTarget()) ? undefined : target.getTrait(DeprecatedTrait);
    },
    isInternal: () => member.hasTrait(InternalTrait),
  };
}
