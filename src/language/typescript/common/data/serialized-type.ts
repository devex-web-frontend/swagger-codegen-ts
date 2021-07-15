import {
	LITERAL_DEPENDENCY,
	monoidDependencies,
	OPTION_DEPENDENCIES,
	serializedDependency,
	SerializedDependency,
	uniqSerializedDependencies,
} from './serialized-dependency';
import { fold, getStructMonoid, Monoid, monoidString } from 'fp-ts/lib/Monoid';
import { intercalate } from 'fp-ts/lib/Foldable';
import { array, getMonoid, uniq } from 'fp-ts/lib/Array';
import { Eq, eqString, getStructEq } from 'fp-ts/lib/Eq';
import { getRelativePath, Ref, uniqRefs } from '../../../../utils/ref';
import { getIOName, getTypeName, UNSAFE_PROPERTY_PATTERN } from '../utils';
import { concatIfL } from '../../../../utils/array';
import { when } from '../../../../utils/string';
import { head, NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { JSONPrimitive } from '../../../../utils/io-ts';
import { pipe } from 'fp-ts/lib/pipeable';
import { nonEmptyArray, option } from 'fp-ts';
import { none, Option, some, exists } from 'fp-ts/lib/Option';
import { utilsRef } from '../bundled/utils';
import { Either } from 'fp-ts/lib/Either';
import { combineEither } from '@devexperts/utils/dist/adt/either.utils';

export interface SerializedType {
	readonly type: string;
	readonly io: string;
	readonly dependencies: SerializedDependency[];
	readonly refs: Ref[];
}

export const serializedType = (
	type: string,
	io: string,
	dependencies: SerializedDependency[],
	refs: Ref[],
): SerializedType => ({
	type,
	io,
	dependencies: uniqSerializedDependencies(dependencies),
	refs: uniqRefs(refs),
});

export const monoidSerializedType: Monoid<SerializedType> = getStructMonoid({
	type: monoidString,
	io: monoidString,
	dependencies: monoidDependencies,
	refs: getMonoid<Ref>(),
});

export const foldSerializedTypes = fold(monoidSerializedType);
export const intercalateSerializedTypes = intercalate(monoidSerializedType, array);
const eqSerializedTypeByTypeAndIO: Eq<SerializedType> = getStructEq<Pick<SerializedType, 'type' | 'io'>>({
	type: eqString,
	io: eqString,
});
export const uniqSerializedTypesByTypeAndIO = uniq(eqSerializedTypeByTypeAndIO);
export const SERIALIZED_VOID_TYPE = serializedType(
	'void',
	'tvoid',
	[serializedDependency('void as tvoid', 'io-ts')],
	[],
);
export const SERIALIZED_UNKNOWN_TYPE = serializedType(
	'unknown',
	'unknown',
	[serializedDependency('unknown', 'io-ts')],
	[],
);
export const getSerializedBlobType = (from: Ref): Either<Error, SerializedType> => {
	return combineEither(utilsRef, utilsRef =>
		serializedType(
			'Blob',
			'BlobToBlobIO',
			[serializedDependency('BlobToBlobIO', getRelativePath(from, utilsRef))],
			[],
		),
	);
};
export const SERIALIZED_BOOLEAN_TYPE = serializedType(
	'boolean',
	'boolean',
	[serializedDependency('boolean', 'io-ts')],
	[],
);
export const SERIALIZED_NUMBER_TYPE = serializedType('number', 'number', [serializedDependency('number', 'io-ts')], []);
export const SERIALIZED_INTEGER_TYPE = serializedType('Int', 'Int', [serializedDependency('Int', 'io-ts')], []);
export const SERIALIZED_DATETIME_TYPE = serializedType(
	'Date',
	'DateFromISOString',
	[serializedDependency('DateFromISOString', 'io-ts-types/lib/DateFromISOString')],
	[],
);
export const SERIALIZED_DATE_TYPE = serializedType(
	'Date',
	'DateFromISODateStringIO',
	[serializedDependency('DateFromISODateStringIO', '../utils/utils')],
	[],
);
export const SERIALIZED_STRING_TYPE = serializedType('string', 'string', [serializedDependency('string', 'io-ts')], []);
export const getSerializedStringType = (from: Ref, format: Option<string>): Either<Error, SerializedType> => {
	return combineEither(utilsRef, utilsRef => {
		return pipe(
			format,
			option.chain(format => {
				// https://xml2rfc.tools.ietf.org/public/rfc/html/rfc3339.html#anchor14
				switch (format) {
					case 'date-time': {
						return some(SERIALIZED_DATETIME_TYPE);
					}
					case 'date': {
						return some(
							serializedType(
								'Date',
								'DateFromISODateStringIO',
								[serializedDependency('DateFromISODateStringIO', getRelativePath(from, utilsRef))],
								[],
							),
						);
					}
					case 'byte':
					case 'base64': {
						return some(
							serializedType(
								'Base64',
								'Base64FromStringIO',
								[
									serializedDependency('Base64FromStringIO', getRelativePath(from, utilsRef)),
									serializedDependency('Base64', getRelativePath(from, utilsRef)),
								],
								[],
							),
						);
					}
					case 'binary': {
						return some(
							serializedType(
								'Binary',
								'BinaryFromStringIO',
								[
									serializedDependency('BinaryFromStringIO', getRelativePath(from, utilsRef)),
									serializedDependency('Binary', getRelativePath(from, utilsRef)),
								],
								[],
							),
						);
					}
				}
				return none;
			}),
			option.getOrElse(() => SERIALIZED_STRING_TYPE),
		);
	});
};
export const SERIALIZED_NULL_TYPE = serializedType('null', 'nullType', [serializedDependency('nullType', 'io-ts')], []);
export const getSerializedNullableType = (isNullable: boolean) => (type: SerializedType): SerializedType =>
	isNullable ? getSerializedUnionType([type, SERIALIZED_NULL_TYPE]) : type;

export const getSerializedArrayType = (minItems: Option<number>, name?: string) => (
	serialized: SerializedType,
): SerializedType =>
	pipe(
		minItems,
		exists(minItems => minItems > 0),
		isNonEmpty =>
			isNonEmpty
				? serializedType(
						`NonEmptyArray<${serialized.type}>`,
						`nonEmptyArray(${serialized.io}${when(name !== undefined, `, '${name}'`)})`,
						[
							...serialized.dependencies,
							serializedDependency('nonEmptyArray', 'io-ts-types/lib/nonEmptyArray'),
							serializedDependency('NonEmptyArray', 'fp-ts/lib/NonEmptyArray'),
						],
						serialized.refs,
				  )
				: serializedType(
						`Array<${serialized.type}>`,
						`array(${serialized.io}${when(name !== undefined, `, '${name}'`)})`,
						[...serialized.dependencies, serializedDependency('array', 'io-ts')],
						serialized.refs,
				  ),
	);

export const getSerializedRefType = (from: Ref) => (to: Ref): SerializedType => {
	const isRecursive = from.$ref === to.$ref;
	const p = getRelativePath(from, to);
	const type = getTypeName(to.name);
	const io = getIOName(to.name);
	const ref = to.name === type ? to : { ...to, name: type };
	const dependencies = concatIfL(!isRecursive, [], () => [
		serializedDependency(type, p),
		serializedDependency(io, p),
	]);
	return serializedType(type, io, dependencies, [ref]);
};

export const getSerializedObjectType = (name?: string) => (serialized: SerializedType): SerializedType =>
	serializedType(
		`{ ${serialized.type} }`,
		`type({ ${serialized.io} }${when(name !== undefined, `, '${name}'`)})`,
		[...serialized.dependencies, serializedDependency('type', 'io-ts')],
		serialized.refs,
	);

export const getSerializedDictionaryType = (name?: string) => (serialized: SerializedType): SerializedType =>
	serializedType(
		`{ [key: string]: ${serialized.type} }`,
		`record(string, ${serialized.io}${when(name !== undefined, `, '${name}'`)})`,
		[...serialized.dependencies, serializedDependency('record', 'io-ts'), serializedDependency('string', 'io-ts')],
		serialized.refs,
	);

export const getSerializedRecursiveType = (from: Ref, shouldTrackRecursion: boolean) => (
	serialized: SerializedType,
): SerializedType => {
	const typeName = getTypeName(from.name);
	const ioName = getIOName(from.name);
	return shouldTrackRecursion && serialized.refs.some(ref => ref.$ref === from.$ref)
		? serializedType(
				serialized.type,
				`recursion<${typeName}, unknown>('${ioName}', ${ioName} => ${serialized.io})`,
				[...serialized.dependencies, serializedDependency('recursion', 'io-ts')],
				serialized.refs,
		  )
		: serialized;
};

export const getSerializedUnionType = (serialized: NonEmptyArray<SerializedType>): SerializedType => {
	if (serialized.length === 1) {
		return head(serialized);
	} else {
		const intercalated = intercalateSerializedTypes(serializedType(' | ', ',', [], []), serialized);
		return serializedType(
			`(${intercalated.type})`,
			`union([${intercalated.io}])`,
			[...intercalated.dependencies, serializedDependency('union', 'io-ts')],
			intercalated.refs,
		);
	}
};

export const getSerializedIntersectionType = (serialized: NonEmptyArray<SerializedType>): SerializedType => {
	if (serialized.length === 1) {
		return head(serialized);
	} else {
		const intercalated = intercalateSerializedTypes(serializedType(' & ', ',', [], []), serialized);
		return serializedType(
			`${intercalated.type}`,
			`intersection([${intercalated.io}])`,
			[...intercalated.dependencies, serializedDependency('intersection', 'io-ts')],
			intercalated.refs,
		);
	}
};

export const getSerializedEnumType = (value: NonEmptyArray<JSONPrimitive>): SerializedType =>
	pipe(value, nonEmptyArray.map(getSerializedPrimitiveType), getSerializedUnionType);

export const getSerializedPrimitiveType = (value: JSONPrimitive): SerializedType => {
	const serialized = JSON.stringify(value);
	return serializedType(serialized, `literal(${serialized})`, [LITERAL_DEPENDENCY], []);
};

export const getSerializedOptionType = (serialized: SerializedType): SerializedType =>
	serializedType(
		`Option<${serialized.type}>`,
		`optionFromNullable(${serialized.io})`,
		[...serialized.dependencies, ...OPTION_DEPENDENCIES],
		serialized.refs,
	);

export const getSerializedOptionalType = (isRequired: boolean, serialized: SerializedType): SerializedType =>
	isRequired ? serialized : getSerializedOptionType(serialized);

export const getSerializedPropertyType = (
	name: string,
	isRequired: boolean,
	serialized: SerializedType,
): SerializedType => {
	const safeName = UNSAFE_PROPERTY_PATTERN.test(name) ? `['${name}']` : name;
	return serializedType(
		`${safeName}${when(!isRequired, '?')}: ${serialized.type}`,
		`${safeName}: ${serialized.io}`,
		serialized.dependencies,
		serialized.refs,
	);
};

export const getSerializedOptionPropertyType = (name: string, isRequired: boolean) => (
	serialized: SerializedType,
): SerializedType => getSerializedPropertyType(name, true, getSerializedOptionalType(isRequired, serialized));
