import * as t from 'io-ts';
import { BaseParameterObjectProps } from './base-parameter-object';
import { booleanOption } from '../../../utils/io-ts';
import { SchemaObject } from '../schema-object/schema-object';
import { Option } from 'fp-ts/lib/Option';

export interface BodyParameterObject extends BaseParameterObjectProps {
	readonly in: 'body';
	readonly required: Option<boolean>;
	readonly schema: SchemaObject;
}

export const BodyParameterObject = t.type(
	{
		...BaseParameterObjectProps,
		in: t.literal('body'),
		required: booleanOption,
		schema: SchemaObject,
	},
	'BodyParameterObject',
);
