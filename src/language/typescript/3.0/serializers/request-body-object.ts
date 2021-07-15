import { serializeSchemaObject } from './schema-object';
import {
	getSerializedBlobType,
	getSerializedRefType,
	SerializedType,
	SERIALIZED_STRING_TYPE,
} from '../../common/data/serialized-type';
import { Either, mapLeft } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import { either, option } from 'fp-ts';
import { fromString, Ref } from '../../../../utils/ref';
import { RequestBodyObject } from '../../../../schema/3.0/request-body-object';
import { ReferenceObjectCodec, ReferenceObject } from '../../../../schema/3.0/reference-object';
import { SchemaObject } from '../../../../schema/3.0/schema-object';
import { getKeyMatchValue, getResponseTypeFromMediaType, XHRResponseType } from '../../common/utils';
import { MediaTypeObject } from '../../../../schema/3.0/media-type-object';

const requestMediaRegexp = /^(video|audio|image|application|text|multipart\/form-data)/;
export const getRequestMedia = (content: Record<string, MediaTypeObject>) =>
	getKeyMatchValue(content, requestMediaRegexp);

export const serializeRequestBodyObject = (from: Ref, body: RequestBodyObject): Either<Error, SerializedType> =>
	pipe(
		getRequestMedia(body.content),
		option.chain(({ key: mediaType, value: { schema } }) =>
			pipe(
				schema,
				option.map(schema => ({ mediaType, schema })),
			),
		),
		either.fromOption(() => new Error('No schema found for ReqeustBodyObject')),
		either.chain(({ mediaType, schema }) => {
			const resType = getResponseTypeFromMediaType(mediaType);
			return serializeRequestSchema(resType, schema, from);
		}),
	);

const serializeRequestSchema = (
	responseType: XHRResponseType,
	schema: ReferenceObject | SchemaObject,
	from: Ref,
): Either<Error, SerializedType> => {
	switch (responseType) {
		case 'json':
			return ReferenceObjectCodec.is(schema)
				? pipe(
						fromString(schema.$ref),
						mapLeft(
							() => new Error(`Invalid MediaObject.content.$ref "${schema.$ref}" for RequestBodyObject`),
						),
						either.map(getSerializedRefType(from)),
				  )
				: serializeSchemaObject(from)(schema);
		case 'text':
			return either.right(SERIALIZED_STRING_TYPE);
		case 'blob':
			return getSerializedBlobType(from);
	}
};
