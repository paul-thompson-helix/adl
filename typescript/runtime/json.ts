import {DeclResolver,ATypeExpr} from './adl';
import * as AST from './sys/adlast';
import * as b64 from 'base64-js';
import {isVoid, isEnum, scopedNamesEqual} from './utils';

/** A type alias for json serialised values */
type Json = {}|null;

/** A type alias for values of an Unknown type */
type Unknown = {}|null;

/**
 * A JsonBinding is a de/serialiser for a give ADL type
 */
export interface JsonBinding<T> {
  typeExpr : AST.TypeExpr;

  // Convert a value of type T to Json
  toJson (t : T): Json;

  // Parse a json blob into a value of type T. Throws
  // JsonParseExceptions on failure.
  fromJson(json : Json) : T;

  // Variant of fromJson that throws Errors on failure
  fromJsonE(json : Json) : T;
};

/**
 * Construct a JsonBinding for an arbitrary type expression
 */
export function createJsonBinding<T>(dresolver : DeclResolver, texpr : ATypeExpr<T>) : JsonBinding<T> {
  const jb0 = buildJsonBinding(dresolver, texpr.value, {}) as JsonBinding0<T>;
  function fromJsonE(json :Json): T {
    try {
      return jb0.fromJson(json);
    } catch (e) {
      throw mapJsonException(e);
    }
  }
  return {typeExpr : texpr.value, toJson:jb0.toJson, fromJson:jb0.fromJson, fromJsonE};
};

/**
 * Interface for json parsing exceptions.
 * Any implementation should properly show the parse error tree.
 *
 *  @interface JsonParseException
 */
export interface JsonParseException {
  kind: 'JsonParseException';
  getMessage(): string;
  pushField(fieldName: string): void;
  pushIndex(index: number): void;
  toString(): string;
}

// Map a JsonException to an Error value
export function mapJsonException(exception:any): any {
  if (exception && exception['kind'] == "JsonParseException") {
    const jserr: JsonParseException = exception as JsonParseException;
    return new Error(jserr.getMessage());
  } else {
    return exception;
  }
}

/** Convenience function for generating a json parse exception.
 *  @param {string} message - Exception message.
 */
export function jsonParseException(message: string): JsonParseException {
  const context: string[] = [];
  let createContextString: () => string = () => {
    const rcontext: string[] = context.slice(0);
    rcontext.push('$');
    rcontext.reverse();
    return rcontext.join('.');
  };
  return {
    kind: 'JsonParseException',
    getMessage(): string {
      return message + ' at ' + createContextString();
    },
    pushField(fieldName: string): void {
      context.push(fieldName);
    },
    pushIndex(index: number): void {
      context.push('[' + index + ']');
    },
    toString(): string {
      return this.getMessage();
    }
  };
}

/**
 * Check if a javascript error is of the json parse exception type.
 * @param exception The exception to check.
 */
export function isJsonParseException(exception: {}): exception is JsonParseException {
  return (<JsonParseException> exception).kind === 'JsonParseException';
}

interface JsonBinding0<T> {
  toJson (t : T): Json;
  fromJson(json : Json) : T;
};

interface BoundTypeParams {
  [key: string]: JsonBinding0<Unknown>;
}

function buildJsonBinding(dresolver : DeclResolver, texpr : AST.TypeExpr, boundTypeParams : BoundTypeParams) : JsonBinding0<Unknown> {
  if (texpr.typeRef.kind === "primitive") {
    return primitiveJsonBinding(dresolver, texpr.typeRef.value, texpr.parameters, boundTypeParams);
  } else if (texpr.typeRef.kind === "reference") {
    const ast = dresolver(texpr.typeRef.value);
    if (ast.decl.type_.kind === "struct_") {
      return structJsonBinding(dresolver, ast.decl.type_.value, texpr.parameters, boundTypeParams);
    } else if (ast.decl.type_.kind === "union_") {
      const union = ast.decl.type_.value;
      if (isEnum(union)) {
        return enumJsonBinding(dresolver, union, texpr.parameters, boundTypeParams);
      } else {
        return unionJsonBinding(dresolver, union, texpr.parameters, boundTypeParams);
      }
    } else if (ast.decl.type_.kind === "newtype_") {
      return newtypeJsonBinding(dresolver, ast.decl.type_.value, texpr.parameters, boundTypeParams);
    } else if (ast.decl.type_.kind === "type_") {
      return typedefJsonBinding(dresolver, ast.decl.type_.value, texpr.parameters, boundTypeParams);
    }
  } else if (texpr.typeRef.kind === "typeParam") {
    return boundTypeParams[texpr.typeRef.value];
  }
  throw new Error("buildJsonBinding : unimplemented ADL type");
};

function primitiveJsonBinding(dresolver : DeclResolver, ptype : string, params : AST.TypeExpr[], boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {
  if      (ptype === "String")     { return identityJsonBinding("a string", (v) => typeof(v) === 'string'); }
  else if (ptype === "Int8")       { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Void")       { return identityJsonBinding("a null", (v) => v === null); }
  else if (ptype === "Bool")       { return identityJsonBinding("a bool", (v) => typeof(v) === 'boolean'); }
  else if (ptype === "Int8")       { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Int16")      { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Int32")      { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Int64")      { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Word8")      { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Word16")     { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Word32")     { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Word64")     { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Float")      { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Double")     { return identityJsonBinding("a number", (v) => typeof(v) === 'number'); }
  else if (ptype === "Json")       { return identityJsonBinding("a json value", (_v) => true); }
  else if (ptype === "Bytes")      { return bytesJsonBinding(); }
  else if (ptype === "Vector")     { return vectorJsonBinding(dresolver, params[0], boundTypeParams); }
  else if (ptype === "StringMap")  { return stringMapJsonBinding(dresolver, params[0], boundTypeParams); }
  else if (ptype === "Nullable")   { return nullableJsonBinding(dresolver, params[0], boundTypeParams); }
  else throw new Error("Unimplemented json binding for primitive " + ptype);
};

function identityJsonBinding<T>(expected : string, predicate : (json : Json) => boolean) : JsonBinding0<T>{

  function toJson(v : T) : Json {
    return v;
  }

  function fromJson(json : Json) : T {
    if( !predicate(json)) {
      throw jsonParseException("expected " + expected);
    }
    return json as T;
  }

  return {toJson, fromJson};
}

function bytesJsonBinding() : JsonBinding0<Uint8Array> {
  function toJson(v : Uint8Array) : Json {
    return b64.fromByteArray(v);
  }

  function fromJson(json : Json) : Uint8Array {
    if (typeof(json) != 'string') {
      throw jsonParseException('expected a string');
    }
    return b64.toByteArray(json);
  }

  return {toJson, fromJson};
}

function vectorJsonBinding(dresolver : DeclResolver, texpr : AST.TypeExpr, boundTypeParams : BoundTypeParams) : JsonBinding0<Unknown[]> {
  const elementBinding = once(() => buildJsonBinding(dresolver, texpr, boundTypeParams));

  function toJson(v : Unknown[]) : Json {
    return v.map(elementBinding().toJson);
  }

  function fromJson(json : Json) : Unknown[] {
      if (!(json instanceof Array)) {
        throw jsonParseException('expected an array');
      }
      let result : Unknown[] = [];
      json.forEach( (eljson,i) => {
        try {
          result.push(elementBinding().fromJson(eljson));
        } catch(e) {
          if (isJsonParseException(e)) {
            e.pushIndex(i);
          }
          throw e;
        }
      });
    return result;
  }

  return {toJson, fromJson};
}

type StringMap<T> = {[key:string]: T};

function stringMapJsonBinding(dresolver : DeclResolver, texpr : AST.TypeExpr, boundTypeParams : BoundTypeParams) : JsonBinding0<StringMap<Unknown>> {
  const elementBinding = once(() => buildJsonBinding(dresolver, texpr, boundTypeParams));

  function toJson(v : StringMap<Unknown>) : Json {
    const result : StringMap<Json> = {};
    for (let k in v) {
      result[k] = elementBinding().toJson(v[k]);
    }
    return result;
  }

  function fromJson(json : Json) : StringMap<Unknown> {
    if (!(json instanceof Object)) {
      throw jsonParseException('expected an object');
    }
    let result : StringMap<Unknown> = {};
    for (let k in json) {
      try {
        const field : Json = (json as StringMap<Json>)[k];
        result[k] = elementBinding().fromJson(field);
      } catch(e) {
        if (isJsonParseException(e)) {
          e.pushField(k);
        }
      }
    }
    return result;
  }

  return {toJson, fromJson};
}

function nullableJsonBinding(dresolver : DeclResolver, texpr : AST.TypeExpr, boundTypeParams : BoundTypeParams) : JsonBinding0<Unknown> {
  const elementBinding = once(() => buildJsonBinding(dresolver, texpr, boundTypeParams));

  function toJson(v : Unknown) : Json {
    if (v === null) {
      return null;
    }
    return elementBinding().toJson(v);
  }

  function fromJson(json : Json) : Unknown {
    if (json === null) {
      return null;
    }
    return elementBinding().fromJson(json);
  }

  return {toJson,fromJson};
}

interface StructFieldDetails {
  field : AST.Field,
  jsonBinding : () => JsonBinding0<Unknown>,
  buildDefault : () => { value : Unknown } | null
};

function structJsonBinding(dresolver : DeclResolver, struct : AST.Struct, params : AST.TypeExpr[], boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {
  const newBoundTypeParams = createBoundTypeParams(dresolver, struct.typeParams, params, boundTypeParams);
  const fieldDetails : StructFieldDetails[] = [];
  struct.fields.forEach( (field) => {
    let buildDefault = once( () => {
      if (field.default.kind === "just")  {
        const json = field.default.value;
        return { 'value' : buildJsonBinding(dresolver, field.typeExpr, newBoundTypeParams).fromJson(json)};
      } else {
        return null;
      }
    });

    fieldDetails.push( {
      field : field,
      jsonBinding : once(() => buildJsonBinding(dresolver, field.typeExpr, newBoundTypeParams)),
      buildDefault : buildDefault,
    });
  });

  function toJson(v: Unknown) : Json {
    const json : StringMap<Json> = {};

    fieldDetails.forEach( (fd) => {
      json[fd.field.serializedName] = fd.jsonBinding().toJson(v && (v as StringMap<Json>)[fd.field.name]);
    });
    return json;
  }

  function fromJson(json: Json): Unknown {
    if (!(json instanceof Object)) {
      throw jsonParseException("expected an object");
    }
    const jsonObj = json as StringMap<Json>;

    const v : StringMap<Unknown> = {};
    fieldDetails.forEach( (fd) => {
      if (jsonObj[fd.field.serializedName] === undefined) {
        const defaultv = fd.buildDefault();
        if (defaultv === null)  {
          throw jsonParseException("missing struct field " + fd.field.serializedName );
        } else {
          v[fd.field.name] = defaultv.value;
        }
      } else {
        try {
          v[fd.field.name] = fd.jsonBinding().fromJson(jsonObj[fd.field.serializedName]);
        } catch(e) {
          if (isJsonParseException(e)) {
            e.pushField(fd.field.serializedName);
          }
          throw e;
        }
      }
    });
    return v;
  }

  return {toJson, fromJson};
}

function enumJsonBinding(_dresolver : DeclResolver, union : AST.Union, _params : AST.TypeExpr[], _boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {
  const fieldSerializedNames : string[] = [];
  const fieldNumbers : StringMap<number> = {};
  union.fields.forEach( (field,i) => {
    fieldSerializedNames.push(field.serializedName);
    fieldNumbers[field.serializedName] = i;
  });

  function toJson(v :Unknown) : Json {
    return fieldSerializedNames[v as number];
  }

  function fromJson(json : Json) : Unknown {
    if (typeof(json) !== 'string') {
      throw jsonParseException("expected a string for enum");
    }
    const fieldIndex = json;
    const result = fieldNumbers[fieldIndex];
    if (result === undefined) {
      throw jsonParseException("invalid string for enum: " + json);
    }
    return result;
  }

  return {toJson, fromJson};
}

function unionJsonBinding(dresolver : DeclResolver, union : AST.Union, params : AST.TypeExpr[], boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {


  const newBoundTypeParams = createBoundTypeParams(dresolver, union.typeParams, params, boundTypeParams);

  type Details = {
    field: AST.Field;
    isVoid: boolean;
    jsonBinding: ()=>JsonBinding0<Unknown>
  };

  const detailsByName : StringMap<Details> = {};
  const detailsBySerializedName : StringMap<Details> = {};
  union.fields.forEach( (field) => {
    const details = {
      field : field,
      isVoid : isVoid(field.typeExpr),
      jsonBinding : once(() => buildJsonBinding(dresolver, field.typeExpr, newBoundTypeParams))
    };
    detailsByName[field.name] = details;
    detailsBySerializedName[field.serializedName] = details;
  });

  function toJson(v0 : Unknown) : Json {
    const v = v0 as {kind:string, value:Unknown};
    const details = detailsByName[v.kind];
    if (details.isVoid) {
      return details.field.serializedName;
    } else {
      const result : StringMap<Json> = {};
      result[details.field.serializedName] = details.jsonBinding().toJson(v.value);
      return result;
    }
  }

  function lookupDetails(serializedName : string) {
    let details = detailsBySerializedName[serializedName];
    if (details === undefined) {
      throw jsonParseException("invalid union field " + serializedName);
    }
    return details;
  }

  function fromJson(json : Json) : Unknown {
    if (typeof(json) === "string") {
      let details = lookupDetails(json);
      if (!details.isVoid) {
        throw jsonParseException("union field " + json + "needs an associated value");
      }
      return { kind : details.field.name };
    } else if (json instanceof Object) {
      for (let k in json) {
        const jsonObj = json as StringMap<Json>;
        let details = lookupDetails(k);
        try {
          return {
            kind : details.field.name,
            value : details.jsonBinding().fromJson(jsonObj[k])
          }
        } catch(e) {
          if (isJsonParseException(e)) {
            e.pushField(k);
          }
          throw e;
        }
      }
      throw jsonParseException("union without a property");
    } else {
      throw jsonParseException("expected an object or string");
    }
  }

  return {toJson, fromJson};
}

function newtypeJsonBinding(dresolver : DeclResolver, newtype : AST.NewType, params : AST.TypeExpr[], boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {
  const newBoundTypeParams = createBoundTypeParams(dresolver, newtype.typeParams, params, boundTypeParams);
  return buildJsonBinding(dresolver, newtype.typeExpr, newBoundTypeParams);
}

function typedefJsonBinding(dresolver : DeclResolver, typedef : AST.TypeDef, params : AST.TypeExpr[], boundTypeParams : BoundTypeParams ) : JsonBinding0<Unknown> {
  const newBoundTypeParams = createBoundTypeParams(dresolver, typedef.typeParams, params, boundTypeParams);
  return buildJsonBinding(dresolver, typedef.typeExpr, newBoundTypeParams);
}

function createBoundTypeParams(dresolver : DeclResolver, paramNames : string[], paramTypes : AST.TypeExpr[], boundTypeParams : BoundTypeParams) : BoundTypeParams
{
  let result : BoundTypeParams = {};
  paramNames.forEach( (paramName,i) => {
    result[paramName] = buildJsonBinding(dresolver,paramTypes[i], boundTypeParams);
  });
  return result;
}

/**
 * Helper function that takes a thunk, and evaluates it only on the first call. Subsequent
 * calls return the previous value
 */
function once<T>(run : () => T) : () => T {
  let result : T | null = null;
  return () => {
    if(result === null) {
      result = run();
    }
    return result;
  };
}

/**
 * Get the value of an annotation of type T
 */
export function getAnnotation<T>(jb: JsonBinding<T>, annotations: AST.Annotations): T | undefined {
  if (jb.typeExpr.typeRef.kind != 'reference') {
    return undefined;
  }
  const annScopedName :AST.ScopedName = jb.typeExpr.typeRef.value;

  const ann = annotations.find(el => scopedNamesEqual(el.v1, annScopedName));
  if (ann === undefined) {
    return undefined;
  }
  return jb.fromJsonE(ann.v2);
}




// Checking out whether we could use presence of fields to type guard on ADL style union fields
// https://github.com/microsoft/TypeScript/pull/15256

type T1 = {
  fieldT1: {
    k1: string;
  }
};

type T2 = {
  fieldT2: {
    k2: number;
  }
};

type T3 = {
  fieldT3: {
    k3: null;
  }
};

// Conclusion:

function mostlyWorks() {
  type UnionType = T1|T2|T3;
  const x1 : UnionType = {fieldT1:{k1:'111'}};
  const x2 : UnionType = {fieldT2:{k2:111}};
  const x3 : UnionType = {fieldT3:{k3:null}};
  // const xqx : X = {fieldT1:{k1:'111'}, fieldT3:{k3:null}}; // But it allows this without error

  let xs = [x1,x2,x3];

  for(const v of xs) {
    if('fieldT1' in v) {
      // x is type T1 OK
      const x = v;
    }
  }
}

function works() {
  type OnlyOneFieldOf<T> = {
    // for each field of T
    [k in keyof T]:
      // take the one field k of T
      Pick<T, k> &
      {
        // for each field of T other than k
        [k1 in Exclude<keyof T, k>]

          // can (should) be absent (ie undefined)
          ?:

          // and can never be present
          never;
      }
    ;
  }[
    // convert to final union type with exclusives

    // convert {fieldT1: {fieldT1:{...}, fieldT2?:never}, fieldT2: {fieldT2:{...}, fieldT1?:never}}
    // to the final union: {fieldT1:{...}, fieldT2?:never} | fieldT2: {fieldT2:{...}, fieldT1?:never}
    keyof T
  ];

  type X = OnlyOneFieldOf<T1&T2&T3>;
  const xq1 : X = {fieldT1:{k1:'111'}};
  const xq2 : X = {fieldT2:{k2:111}};
  const xq3 : X = {fieldT3:{k3:null}};
  // const xqx : X = {fieldT1:{k1:'111'}, fieldT3:{k3:null}};  // successfully blocks this with error

  let xqs = [xq1,xq2,xq3];

  // type guard function
  // https://riptutorial.com/typescript/example/25953/type-guarding-functions
  function isT1(x: X) : x is T1 {
    return x['fieldT1'] !== undefined;
  }

  for(const v of xqs) {
    /// type guards on presence of union field
    if(v['fieldT1'] !== undefined) {
      const x = v;
    }
  }
}





/*function isT1( o: T1|T2) : o is T1 {
  return
}*/

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;


type Without2<T, U> = { [P in Exclude<keyof (Exclude<T,U>), keyof U>]?: never } & U;
//type Without2<T, U> = { [P in Exclude<keyof (Exclude<T,U>), keyof U>]?: never } & U;
type XOR2<T, U> = (T | U) extends object ? (Without2<T|U, U>) | (Without2<T|U, T>) : T | U;
type XOR3<T, U, V> = (T | U | V) extends object ? Without2<T|U|V, U> | Without2<T|U|V, T> | Without2<T|U|V, V> : T | U | V;
//type XOR2<T, U, V> = (T | U | V) extends object ? Without2<T|V, U> | Without2<U|V, T> | Without2<T|U, V> : T | U | V;

//type XOR3<T, U, V> = (T | U | V) extends object ? Without2<T|U|V, U> | Without2<T|U|V, T> | Without2<T|U|V, V> : T | U | V;

//type All = T1|T2|T3;
//type T1T2 = Exclude<All, T1>


const xx : T1|T2 = {fieldT1: {k1:'111'}, fieldT2:{k2:123}};
const yy : XOR<T1,T2> = {fieldT1: {k1:'111'}};
const zz : XOR<T1,T2> = {fieldT2: {k2:111}};

const zzz1 : XOR2<T1,T2> = {fieldT1: {k1:'111'}};
const zzz2 : XOR2<T1,T2> = {fieldT2: {k2:111}};
const zzzx : XOR2<T1,T2> = {fieldT1: {k1:'111'}, fieldT2: {k2:111}};

const zzzz1 : XOR3<T1,T2,T3> = {fieldT1: {k1:'111'}};
const zzzz2 : XOR3<T1,T2,T3> = {fieldT2: {k2:111}};
const zzzzx : XOR3<T1,T2,T3> = {fieldT1: {k1:'111'}, fieldT2: {k2:111}};

// https://timhwang21.gitbook.io/index/programming/typescript/xor-type
type OneOf<T, K extends keyof T> = Omit<T, K> &
  {
    [k in K]: Pick<Required<T>, k> &
      {
        [k1 in Exclude<K, k>]?: never;
      };
  }[K];

type OnlyOneFieldOf<T> = {
  [k in keyof T]: Pick<T, k> & {
    [k1 in Exclude<keyof T, k>]?: never;
  }
  ;
}[keyof T];

//type X = OnlyOneFieldOf<T1&T2&T3>;
//type X = XOR2<T1,XOR2<T2,T3>>;
type X = T1|T2|T3;
const xq1 : X = {fieldT1:{k1:'111'}};
const xq2 : X = {fieldT2:{k2:111}};
const xq3 : X = {fieldT3:{k3:null}};
// const xqx : X = {fieldT1:{k1:'111'}, fieldT3:{k3:null}};

let xqs = [xq1,xq2,xq3];

for(const v of xqs) {
  if('fieldT1' in v) {
    const x = v;
  }
}


type Q1 = T1 & {
  fieldT2?: never;
  fieldT3?: never;
};

type Q2 = T2 & {
  fieldT1?: never;
} & {
  fieldT3?: never;
};

type Q3 = T3 & {
  fieldT1?: never;
} & {
  fieldT2?: never;
};

type Q = Q1|Q2|Q3;

const qxq1 : Q = {fieldT1:{k1:'111'}};
const qxq2 : Q = {fieldT2:{k2:111}};
const qxq3 : Q = {fieldT3:{k3:null}};
const qxqx : Q = {fieldT1:{k1:'111'}, fieldT3:{k3:null}};
let qxqs = [qxq1,qxq2,qxq3];

for(const v of qxqs) {
  if('fieldT1' in v) {
    const x = v;
  }
}