import { fromString } from '../../../../utils/ref';
import { pipe } from 'fp-ts/lib/pipeable';
import { either } from 'fp-ts';
import { fromRef } from '../../../../utils/fs';

export const utilsRef = fromString('#/utils/utils');

const utils = `
	import { either, left, right } from 'fp-ts/lib/Either';
	import {
		Type,
		type,
		TypeOf,
		failure,
		success,
		string as tstring,
		literal,
		Validate,
		Context,
		getValidationError,
	} from 'io-ts';

	export const DateFromISODateStringIO = new Type<Date, string, unknown>(
		'DateFromISODateString',
		(u): u is Date => u instanceof Date,
		(u, c) =>
			either.chain(tstring.validate(u, c), dateString => {
				const [year, calendarMonth, day] = dateString.split('-');
				const d = new Date(+year, +calendarMonth - 1, +day);
				return isNaN(d.getTime()) ? failure(u, c) : success(d);
			}),
		a =>
			\`\${a.getFullYear().toString().padStart(4, '0')}-\${(a.getMonth() + 1).toString().padStart(2, '0')}-\${a
				.getDate()
				.toString()
				.padStart(2, '0')}\`,
	);
	
	export type Base64 = TypeOf<typeof Base64IO>;

	export const Base64IO = type({
		string: tstring,
		format: literal('base64'),
	});

	export const Base64FromStringIO = new Type<Base64, string, unknown>(
		'Base64FromString',
		(u): u is Base64 => Base64IO.is(u),
		(u, c) => either.chain(tstring.validate(u, c), string => success({ string, format: 'base64' })),
		a => a.string,
	);

	export type Binary = TypeOf<typeof BinaryIO>;

	export const BinaryIO = type({
		string: tstring,
		format: literal('binary'),
	});

	export const BinaryFromStringIO = new Type<Binary, string, unknown>(
		'BinaryFromString',
		(u): u is Binary => BinaryIO.is(u),
		(u, c) => either.chain(tstring.validate(u, c), string => success({ string, format: 'binary' })),
		a => a.string,
	);

	const validateBlob: Validate<unknown, Blob> = (u: unknown, c: Context) =>
		u instanceof Blob ? right(u) : left([getValidationError(u, c)]);

	export const BlobToBlobIO = new Type<Blob, Blob, unknown>(
		'Base64FromString',
		(u): u is Blob => u instanceof Blob,
		validateBlob,
		a => a,
	);

`;

export const utilsFile = pipe(
	utilsRef,
	either.map(ref => fromRef(ref, '.ts', utils)),
);
