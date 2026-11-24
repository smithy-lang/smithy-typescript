import { SourceException } from "../exceptions/exceptions";
import type { Trait } from "../traits/Trait";
import { MemberShape } from "./MemberShape";
import type { Shape } from "./Shape";
import type { ShapeId } from "./ShapeId";

/**
 * Computes the member map of a shape from its mixins and local members, as Smithy's NamedMemberUtils does.
 *
 * @internal
 */
export class NamedMemberUtils {
  /**
   * Mixin members come first in mixin order, then local members that do not override a mixin member.
   */
  public static computeMixinMembers(
    mixins: readonly Shape[],
    localMembers: readonly MemberShape[],
    shapeId: ShapeId
  ): Map<string, MemberShape> {
    const local = new Map<string, MemberShape>();
    for (const member of localMembers) {
      local.set(member.getMemberName(), member);
    }
    if (mixins.length === 0) {
      return local;
    }
    const computed = new Map<string, MemberShape>();
    const computedMixins = new Map<string, MemberShape[]>();
    for (const mixin of mixins) {
      for (const member of mixin.members()) {
        const name = member.getMemberName();
        const localMember = local.get(name);
        if (localMember !== undefined) {
          computed.set(name, NamedMemberUtils._rebuildMemberMixins(localMember, mixins));
          continue;
        }
        const previouslyDefined = computed.get(name);
        if (previouslyDefined !== undefined) {
          NamedMemberUtils._validateMixinMemberConflict(member, previouslyDefined);
          const traits: Trait[] = Array.from(previouslyDefined.getIntroducedTraits().values());
          for (const trait of member.getAllTraits().values()) {
            traits.push(trait);
          }
          const memberMixins = (computedMixins.get(name) as MemberShape[]).concat([member]);
          computedMixins.set(name, memberMixins);
          computed.set(
            name,
            new MemberShape({
              id: previouslyDefined.getId(),
              target: previouslyDefined.getTarget(),
              traits,
              mixins: memberMixins,
            })
          );
        } else {
          computedMixins.set(name, [member]);
          computed.set(
            name,
            new MemberShape({
              id: shapeId.withMember(name),
              target: member.getTarget(),
              mixins: [member],
            })
          );
        }
      }
    }
    for (const [name, member] of local) {
      if (!computed.has(name)) {
        computed.set(name, member);
      }
    }
    return computed;
  }

  /**
   * Resolves a required member such as a list `member` or map `key`, inheriting it from mixins when not declared.
   */
  public static getRequiredMember(
    name: string,
    localMembers: readonly MemberShape[],
    mixins: readonly Shape[],
    shapeId: ShapeId
  ): MemberShape {
    for (const member of localMembers) {
      if (member.getMemberName() === name) {
        return NamedMemberUtils._rebuildMemberMixins(member, mixins);
      }
    }
    let mostRecent: MemberShape | undefined;
    for (const mixin of mixins) {
      const candidate = mixin.getMember(name);
      if (candidate !== undefined) {
        mostRecent = candidate;
      }
    }
    if (mostRecent === undefined) {
      throw new SourceException("Missing required member of shape `" + shapeId + "`: " + name);
    }
    return new MemberShape({
      id: shapeId.withMember(name),
      target: mostRecent.getTarget(),
      mixins: [mostRecent],
    });
  }

  private static _rebuildMemberMixins(member: MemberShape, mixins: readonly Shape[]): MemberShape {
    const memberMixins: MemberShape[] = [];
    for (const mixin of mixins) {
      const mixinMember = mixin.getMember(member.getMemberName());
      if (mixinMember !== undefined) {
        memberMixins.push(mixinMember);
      }
    }
    if (memberMixins.length === 0) {
      return member;
    }
    return new MemberShape({
      id: member.getId(),
      target: member.getTarget(),
      traits: Array.from(member.getIntroducedTraits().values()),
      mixins: memberMixins,
    });
  }

  private static _validateMixinMemberConflict(member: MemberShape, previouslyDefined: MemberShape): void {
    if (previouslyDefined.getTarget() !== member.getTarget()) {
      throw new SourceException("Member conflicts with an inherited mixin member: `" + previouslyDefined.getId() + "`");
    }
  }
}
