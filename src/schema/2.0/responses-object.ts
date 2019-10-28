import { Dictionary } from '../../utils/types';
import { ResponseObject } from './response-object';
import { Codec, dictionary } from '../../utils/io-ts';
import { ReferenceObject } from './reference-object';
import { union } from 'io-ts';

export interface ResponsesObject extends Dictionary<ReferenceObject | ResponseObject> {}

export const ResponsesObject: Codec<ResponsesObject> = dictionary(
	union([ReferenceObject, ResponseObject]),
	'ResponsesObject',
);
