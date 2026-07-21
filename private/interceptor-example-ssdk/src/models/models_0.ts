// smithy-typescript generated code
import {
  CompositeValidator as __CompositeValidator,
  MultiConstraintValidator as __MultiConstraintValidator,
  NoOpValidator as __NoOpValidator,
  RequiredValidator as __RequiredValidator,
  ValidationFailure as __ValidationFailure,
} from "@smithy/server-common";

/**
 * @public
 */
export interface GetItemInput {
  id: string | undefined;
}

export namespace GetItemInput {
  const memberValidators : {
    id?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: GetItemInput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "id": {
            memberValidators["id"] = new __CompositeValidator<string>([
              new __RequiredValidator(),
            ]);
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("id").validate(obj.id, `${path}/id`),
    ];
  }
}

/**
 * @public
 */
export interface GetItemOutput {
  id?: string | undefined;
  name?: string | undefined;
}

export namespace GetItemOutput {
  const memberValidators : {
    id?: __MultiConstraintValidator<string>,
    name?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: GetItemOutput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "id": {
            memberValidators["id"] = new __NoOpValidator();
            break;
          }
          case "name": {
            memberValidators["name"] = new __NoOpValidator();
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("id").validate(obj.id, `${path}/id`),
      ...getMemberValidator("name").validate(obj.name, `${path}/name`),
    ];
  }
}

/**
 * @public
 */
export interface PingInput {
  message?: string | undefined;
}

export namespace PingInput {
  const memberValidators : {
    message?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: PingInput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "message": {
            memberValidators["message"] = new __NoOpValidator();
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("message").validate(obj.message, `${path}/message`),
    ];
  }
}

/**
 * @public
 */
export interface PingOutput {
  message?: string | undefined;
}

export namespace PingOutput {
  const memberValidators : {
    message?: __MultiConstraintValidator<string>,
  } = {};
  /**
   * @internal
   */
  export const validate = (obj: PingOutput, path: string = ""): __ValidationFailure[] => {
    function getMemberValidator<T extends keyof typeof memberValidators>(member: T): NonNullable<typeof memberValidators[T]> {
      if (memberValidators[member] === undefined) {
        switch (member) {
          case "message": {
            memberValidators["message"] = new __NoOpValidator();
            break;
          }
        }
      }
      return memberValidators[member]!!;
    }
    return [
      ...getMemberValidator("message").validate(obj.message, `${path}/message`),
    ];
  }
}
