import {
	SerializedType,
	getSerializedRefType,
	SERIALIZED_STRING_TYPE,
	getSerializedBlobType,
} from '../../common/data/serialized-type';
import { pipe } from 'fp-ts/lib/pipeable';
import { serializeSchemaObject } from './schema-object';
import { Either } from 'fp-ts/lib/Either';
import { fromString, Ref } from '../../../../utils/ref';
import { either, option } from 'fp-ts';
import { ResponseObject } from '../../../../schema/3.0/response-object';
import { Option } from 'fp-ts/lib/Option';
import { ReferenceObject, ReferenceObjectCodec } from '../../../../schema/3.0/reference-object';
import { getKeyMatchValue, getResponseTypeFromMediaType, XHRResponseType } from '../../common/utils';
import { SchemaObject } from '../../../../schema/3.0/schema-object';
import { MediaTypeObject } from '../../../../schema/3.0/media-type-object';

const requestMediaRegexp = /^(video|audio|image|application|text)/;
export const getResponseMedia = (content: Record<string, MediaTypeObject>) =>
	getKeyMatchValue(content, requestMediaRegexp);

export const serializeResponseObject = (
	from: Ref,
	responseObject: ResponseObject,
): Option<Either<Error, SerializedType>> =>
	pipe(
		responseObject.content,
		option.chain(content => getResponseMedia(content)),
		option.chain(({ key: mediaType, value: { schema } }) =>
			pipe(
				schema,
				option.map(schema => ({ mediaType, schema })),
			),
		),
		option.map(({ mediaType, schema }) => {
			const resType = getResponseTypeFromMediaType(mediaType);
			return serializeResponseSchema(resType, schema, from);
		}),
	);

const serializeResponseSchema = (
	responseType: XHRResponseType,
	schema: ReferenceObject | SchemaObject,
	from: Ref,
): Either<Error, SerializedType> => {
	switch (responseType) {
		case 'json':
			return ReferenceObjectCodec.is(schema)
				? pipe(fromString(schema.$ref), either.map(getSerializedRefType(from)))
				: serializeSchemaObject(from)(schema);
		case 'text':
			return either.right(SERIALIZED_STRING_TYPE);
		case 'blob':
			return getSerializedBlobType(from);
	}
};
