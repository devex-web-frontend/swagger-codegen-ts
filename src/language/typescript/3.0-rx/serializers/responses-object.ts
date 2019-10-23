import { OpenAPIV3 } from 'openapi-types';
import {
	intercalateSerializedTypes,
	serializedType,
	SerializedType,
	uniqSerializedTypesWithoutDependencies,
	SERIALIZED_VOID_TYPE,
	getSerializedRefType,
} from '../../common/data/serialized-type';
import { SUCCESSFUL_CODES } from '../../common/utils';
import { pipe } from 'fp-ts/lib/pipeable';
import { serializeResponseObject } from './response-object';
import { compactNullables } from '../../../../utils/nullable';
import * as nullable from '../../../../utils/nullable';
import { serializedDependency } from '../../common/data/serialized-dependency';
import { concatIfL } from '../../../../utils/array';
import { sequenceEither } from '../../../../utils/either';
import { array, either } from 'fp-ts';
import { isReferenceObject } from './reference-object';
import { Either } from 'fp-ts/lib/Either';
import { fromString } from '../../../../utils/ref';

export const serializeResponsesObject = (rootName: string, cwd: string) => (
	responsesObject: OpenAPIV3.ResponsesObject,
): Either<Error, SerializedType> => {
	const serializedResponses = pipe(
		SUCCESSFUL_CODES,
		array.map(code =>
			pipe(
				responsesObject[code],
				nullable.map(r =>
					isReferenceObject(r)
						? pipe(
								r.$ref,
								fromString(ref => new Error(`Invalid ${ref} for ResponsesObject'c code "${code}"`)),
								either.map(getSerializedRefType(rootName, cwd)),
						  )
						: serializeResponseObject(code, rootName, cwd, r),
				),
			),
		),
		compactNullables,
		sequenceEither,
		either.map(uniqSerializedTypesWithoutDependencies),
	);
	return pipe(
		serializedResponses,
		either.map(serializedResponses => {
			if (serializedResponses.length === 0) {
				return SERIALIZED_VOID_TYPE;
			}
			const combined = intercalateSerializedTypes(serializedType('|', ',', [], []), serializedResponses);
			const isUnion = serializedResponses.length > 1;
			return serializedType(
				combined.type,
				isUnion ? `union([${combined.io}])` : combined.io,
				concatIfL(isUnion, combined.dependencies, () => [serializedDependency('union', 'io-ts')]),
				[],
			);
		}),
	);
};
