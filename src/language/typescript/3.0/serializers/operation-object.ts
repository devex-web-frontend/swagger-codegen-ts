import { Context, getJSDoc, getKindValue, getURL, HTTPMethod } from '../../common/utils';
import {
	getSerializedPropertyType,
	getSerializedObjectType,
	getSerializedRefType,
	serializedType,
	SerializedType,
	getSerializedOptionalType,
	intercalateSerializedTypes,
} from '../../common/data/serialized-type';
import {
	getParameterObjectSchema,
	isRequired,
	serializeParameterObject,
	serializeParameterToTemplate,
} from './parameter-object';
import { pipe } from 'fp-ts/lib/pipeable';
import { getSerializedKindDependency, serializedDependency } from '../../common/data/serialized-dependency';
import { serializeResponsesObject } from './responses-object';
import { array, either, nonEmptyArray, option } from 'fp-ts';
import { Either, isLeft, left, right } from 'fp-ts/lib/Either';
import { combineReader } from '@devexperts/utils/dist/adt/reader.utils';
import { combineEither } from '@devexperts/utils/dist/adt/either.utils';
import { fromSerializedType } from '../../common/data/serialized-parameter';
import {
	fromSerializedParameter,
	getSerializedPathParameterType,
	SerializedPathParameter,
} from '../../common/data/serialized-path-parameter';
import { concatIf } from '../../../../utils/array';
import { when } from '../../../../utils/string';
import { serializeRequestBodyObject } from './request-body-object';
import { fromString, getRelativePath, Ref } from '../../../../utils/ref';
import { OperationObject } from '../../../../schema/3.0/operation-object';
import { ParameterObject, ParameterObjectCodec } from '../../../../schema/3.0/parameter-object';
import { RequestBodyObjectCodec } from '../../../../schema/3.0/request-body-object';
import { isSome, none, Option, some } from 'fp-ts/lib/Option';
import { constFalse } from 'fp-ts/lib/function';
import { clientRef } from '../../common/bundled/client';
import { Kind } from '../../../../utils/types';
import { ReferenceObjectCodec } from '../../../../schema/3.0/reference-object';
import { PathItemObject } from '../../../../schema/3.0/path-item-object';
import { Eq, eqString, getStructEq } from 'fp-ts/lib/Eq';
import { ask } from 'fp-ts/lib/Reader';
import {
	combineFragmentsK,
	intercalateSerializedFragmentsNEA,
	serializedFragment,
	SerializedFragment,
} from '../../common/data/serialized-fragment';
import { reportIfFailed } from '../../../../utils/io-ts';
import { SchemaObjectCodec } from '../../../../schema/3.0/schema-object';

const getOperationName = (operation: OperationObject, method: HTTPMethod): string =>
	pipe(
		operation.operationId,
		option.getOrElse(() => method.toString()),
	);

interface Parameters {
	readonly pathParameters: ParameterObject[];
	readonly serializedPathParameters: SerializedPathParameter[];
	readonly serializedQueryParameter: Option<SerializedType>;
	readonly serializedBodyParameter: Option<SerializedType>;
	readonly serializedQueryString: Option<SerializedFragment>;
}

const eqParameterByNameAndIn: Eq<ParameterObject> = getStructEq({
	name: eqString,
	in: eqString,
});
const contains = array.elem(eqParameterByNameAndIn);

const getParameters = combineReader(
	ask<Context>(),
	e => (from: Ref, operation: OperationObject, pathItem: PathItemObject): Either<Error, Parameters> => {
		const processedParameters: ParameterObject[] = [];
		const pathParameters: ParameterObject[] = [];
		const serializedPathParameters: SerializedPathParameter[] = [];
		const serializedQueryParameters: SerializedType[] = [];
		let serializedBodyParameter: Option<SerializedType> = none;
		const queryStringFragments: SerializedFragment[] = [];

		// note that PathItem parameters should go after OperationObject parameters because they have lower priority
		// this means that OperationObject can override PathItemObject parameters
		const parameters = array.flatten(array.compact([operation.parameters, pathItem.parameters]));

		for (const parameter of parameters) {
			const resolved = ReferenceObjectCodec.is(parameter)
				? reportIfFailed(ParameterObjectCodec.decode(e.resolveRef(parameter)))
				: right(parameter);

			if (isLeft(resolved)) {
				return resolved;
			}

			// if parameter has already been processed then skip it
			if (contains(resolved.right, processedParameters)) {
				continue;
			}
			processedParameters.push(resolved.right);

			const required = isRequired(resolved.right);

			const serialized = ReferenceObjectCodec.is(parameter)
				? pipe(
						fromString(parameter.$ref),
						either.map(getSerializedRefType(from)),
						either.map(fromSerializedType(required)),
				  )
				: serializeParameterObject(from, resolved.right);

			if (isLeft(serialized)) {
				return serialized;
			}

			switch (resolved.right.in) {
				case 'path': {
					pathParameters.push(resolved.right);

					const serializedParameter = pipe(
						serialized.right,
						fromSerializedParameter(resolved.right.name),
						getSerializedPathParameterType,
					);

					serializedPathParameters.push(serializedParameter);
					break;
				}
				case 'query': {
					const serializedParameter = getSerializedOptionalType(required, serialized.right);
					const schema = getParameterObjectSchema(resolved.right);
					const resolvedSchema = pipe(
						schema,
						either.chain(schema =>
							ReferenceObjectCodec.is(schema)
								? reportIfFailed(SchemaObjectCodec.decode(e.resolveRef(schema)))
								: right(schema),
						),
					);

					if (isLeft(resolvedSchema)) {
						return resolvedSchema;
					}

					const queryStringFragment = serializeParameterToTemplate(
						from,
						resolved.right,
						resolvedSchema.right,
						serializedParameter,
						'parameters.query',
					);

					if (isLeft(queryStringFragment)) {
						return queryStringFragment;
					}

					queryStringFragments.push(queryStringFragment.right);

					serializedQueryParameters.push(
						getSerializedPropertyType(resolved.right.name, true, serializedParameter),
					);
					break;
				}
			}
		}

		if (isSome(operation.requestBody)) {
			const requestBody = operation.requestBody.value;
			if (ReferenceObjectCodec.is(requestBody)) {
				const reference = fromString(requestBody.$ref);
				if (isLeft(reference)) {
					return left(new Error(`Invalid RequestBodyObject.$ref "${requestBody.$ref}"`));
				}
				const resolved = option.fromEither(RequestBodyObjectCodec.decode(e.resolveRef(requestBody)));

				if (!isSome(resolved)) {
					return left(new Error(`Unable to resolve RequestBodyObject with ref ${requestBody.$ref}`));
				}
				const serializedReference = pipe(
					reference.right,
					getSerializedRefType(from),
				);

				const required = pipe(
					resolved.value.required,
					option.getOrElse(constFalse),
				);
				serializedBodyParameter = some(getSerializedOptionalType(required, serializedReference));
			} else {
				const required = pipe(
					requestBody.required,
					option.getOrElse(constFalse),
				);
				const serialized = pipe(
					serializeRequestBodyObject(from, requestBody),
					either.map(serialized => getSerializedOptionalType(required, serialized)),
				);
				if (isLeft(serialized)) {
					return serialized;
				}
				serializedBodyParameter = some(serialized.right);
			}
		}

		const serializedQueryParameter = pipe(
			nonEmptyArray.fromArray(serializedQueryParameters),
			option.map(parameters => {
				const intercalated = intercalateSerializedTypes(serializedType(';', ',', [], []), parameters);
				return pipe(
					intercalated,
					getSerializedObjectType(),
				);
			}),
		);

		const serializedQueryString = pipe(
			nonEmptyArray.fromArray(queryStringFragments),
			option.map(queryStringFragments =>
				intercalateSerializedFragmentsNEA(serializedFragment(',', [], []), queryStringFragments),
			),
			option.map(f =>
				combineFragmentsK(f, c =>
					serializedFragment(
						`encodeURIComponent(compact([${c}]).join('&'))`,
						[serializedDependency('compact', 'fp-ts/lib/Array')],
						[],
					),
				),
			),
		);

		return right({
			pathParameters,
			serializedPathParameters,
			serializedQueryParameter,
			serializedBodyParameter,
			serializedQueryString,
		});
	},
);

export const serializeOperationObject = combineReader(
	getParameters,
	getParameters => (
		pattern: string,
		method: HTTPMethod,
		from: Ref,
		kind: Kind,
		operation: OperationObject,
		pathItem: PathItemObject,
	): Either<Error, SerializedType> => {
		const parameters = getParameters(from, operation, pathItem);
		const operationName = getOperationName(operation, method);

		const deprecated = pipe(
			operation.deprecated,
			option.map(() => '@deprecated'),
		);

		const serializedResponses = serializeResponsesObject(from)(operation.responses);

		return combineEither(
			parameters,
			serializedResponses,
			clientRef,
			(parameters, serializedResponses, clientRef) => {
				const hasQueryParameters = isSome(parameters.serializedQueryParameter);
				const hasBodyParameter = isSome(parameters.serializedBodyParameter);
				const hasParameters = hasQueryParameters || hasBodyParameter;

				const bodyType = pipe(
					parameters.serializedBodyParameter,
					option.map(body => `body: ${body.type},`),
					option.getOrElse(() => ''),
				);
				const bodyIO = pipe(
					parameters.serializedBodyParameter,
					option.map(body => `const body = ${body.io}.encode(parameters.body);`),
					option.getOrElse(() => ''),
				);

				const queryType = pipe(
					parameters.serializedQueryParameter,
					option.map(query => `query: ${query.type},`),
					option.getOrElse(() => ''),
				);
				const queryIO = pipe(
					parameters.serializedQueryString,
					option.map(query => `const query = ${query.value};`),
					option.getOrElse(() => ''),
				);

				const argsType = concatIf(hasParameters, parameters.serializedPathParameters.map(p => p.type), [
					`parameters: { ${queryType}${bodyType} }`,
				]).join(',');

				const type = `
					${getJSDoc(array.compact([deprecated, operation.summary]))}
					readonly ${operationName}: (${argsType}) => ${getKindValue(kind, serializedResponses.type)};
				`;

				const argsIO = concatIf(hasParameters, parameters.pathParameters.map(p => p.name), ['parameters']).join(
					',',
				);

				const io = `
					${operationName}: (${argsIO}) => {
						${bodyIO}
						${queryIO}
	
						return e.httpClient.chain(
							e.httpClient.request({
								url: ${getURL(pattern, parameters.serializedPathParameters)},
								method: '${method}',
								${when(hasQueryParameters, 'query,')}
								${when(hasBodyParameter, 'body,')}
							}),
							value =>
								pipe(
									${serializedResponses.io}.decode(value),
									either.mapLeft(ResponseValidationError.create),
									either.fold(error => e.httpClient.throwError(error), decoded => e.httpClient.of(decoded)),
								),
						);
					},
				`;

				const dependencies = [
					serializedDependency('ResponseValidationError', getRelativePath(from, clientRef)),
					serializedDependency('pipe', 'fp-ts/lib/pipeable'),
					serializedDependency('either', 'fp-ts'),
					getSerializedKindDependency(kind),
					...serializedResponses.dependencies,
					...array.flatten([
						...parameters.serializedPathParameters.map(p => p.dependencies),
						...array.compact([
							pipe(
								parameters.serializedQueryParameter,
								option.map(p => p.dependencies),
							),
							pipe(
								parameters.serializedBodyParameter,
								option.map(p => p.dependencies),
							),
							pipe(
								parameters.serializedQueryString,
								option.map(p => p.dependencies),
							),
						]),
					]),
				];

				const refs = array.flatten([
					...parameters.serializedPathParameters.map(p => p.refs),
					...array.compact([
						pipe(
							parameters.serializedQueryParameter,
							option.map(p => p.refs),
						),
						pipe(
							parameters.serializedBodyParameter,
							option.map(p => p.refs),
						),
						pipe(
							parameters.serializedQueryString,
							option.map(p => p.refs),
						),
					]),
				]);

				return serializedType(type, io, dependencies, refs);
			},
		);
	},
);
