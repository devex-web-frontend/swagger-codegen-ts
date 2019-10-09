import { PathParameterObject } from '../../../../schema/2.0/parameter-object/path-parameter-object/path-parameter-object';
import { QueryParameterObject } from '../../../../schema/2.0/parameter-object/query-parameter-object/query-parameter-object';
import { serializedParameter, SerializedParameter } from '../data/serialized-parameter';
import { pipe } from 'fp-ts/lib/pipeable';
import { getOrElse } from 'fp-ts/lib/Option';
import { constFalse } from 'fp-ts/lib/function';
import { serializeNonArrayItemsObject } from './non-array-items-object';
import { dependency } from '../data/serialized-dependency';
import { EMPTY_REFS } from '../utils';

export const serializePathOrQueryParameterObject = (
	parameter: PathParameterObject | QueryParameterObject,
): SerializedParameter => {
	const isRequired =
		typeof parameter.required === 'boolean'
			? parameter.required
			: pipe(
					parameter.required,
					getOrElse(constFalse),
			  );
	switch (parameter.type) {
		case 'array': {
			const serializedArrayItems = serializeNonArrayItemsObject(parameter.items);
			return serializedParameter(
				`Array<${serializedArrayItems.type}>`,
				`array(${serializedArrayItems.io})`,
				isRequired,
				[...serializedArrayItems.dependencies, dependency('array', 'io-ts')],
				serializedArrayItems.refs,
			);
		}
		case 'string': {
			return serializedParameter('string', 'string', isRequired, [dependency('string', 'io-ts')], EMPTY_REFS);
		}
		case 'boolean': {
			return serializedParameter('boolean', 'boolean', isRequired, [dependency('boolean', 'io-ts')], EMPTY_REFS);
		}
		case 'integer':
		case 'number': {
			return serializedParameter('number', 'number', isRequired, [dependency('number', 'io-ts')], EMPTY_REFS);
		}
	}
};
