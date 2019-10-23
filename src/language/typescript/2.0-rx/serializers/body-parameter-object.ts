import { BodyParameterObject } from '../../../../schema/2.0/parameter-object/body-parameter-object';
import { serializedParameter, SerializedParameter } from '../../common/data/serialized-parameter';
import { pipe } from 'fp-ts/lib/pipeable';
import { getOrElse } from 'fp-ts/lib/Option';
import { constFalse } from 'fp-ts/lib/function';
import { serializeSchemaObject } from './schema-object';
import { head, NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { unless } from '../../../../utils/string';

const serializeBodyParameterObject = (
	parameter: BodyParameterObject,
	rootName: string,
	cwd: string,
): SerializedParameter => {
	const isRequired = pipe(
		parameter.required,
		getOrElse(constFalse),
	);
	const serializedParameterType = serializeSchemaObject(parameter.schema, rootName, cwd);
	return serializedParameter(
		serializedParameterType.type,
		serializedParameterType.io,
		isRequired,
		serializedParameterType.dependencies,
		serializedParameterType.refs,
	);
};

export const serializeBodyParameterObjects = (
	parameters: NonEmptyArray<BodyParameterObject>,
	rootName: string,
	cwd: string,
): SerializedParameter => {
	// according to spec there can be only one body parameter
	const serializedBodyParameter = serializeBodyParameterObject(head(parameters), rootName, cwd);
	const { type, isRequired, io, dependencies, refs } = serializedBodyParameter;
	return serializedParameter(
		`body${unless(isRequired, '?')}: ${type}`,
		`body: ${io}`,
		isRequired,
		dependencies,
		refs,
	);
};
