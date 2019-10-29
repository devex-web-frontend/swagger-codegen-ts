import { fromString } from '../../../utils/ref';
import { fromRef } from '../../../utils/fs';
import { either } from 'fp-ts';
import { pipe } from 'fp-ts/lib/pipeable';

export const clientRef = fromString('#/client/client');

const client = `
	import { HKT, Kind, Kind2, URIS, URIS2 } from 'fp-ts/lib/HKT';
	import { MonadThrow, MonadThrow1, MonadThrow2 } from 'fp-ts/lib/MonadThrow';
	import { Errors } from 'io-ts';
	import { PathReporter } from 'io-ts/lib/PathReporter';
	import { left } from 'fp-ts/lib/Either';
	
	export interface Request {
		readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
		readonly url: string;
		readonly query?: object;
		readonly body?: unknown;
	}
	
	export interface HTTPClient<F> extends MonadThrow<F> {
		readonly request: (request: Request) => HKT<F, unknown>;
	}
	export interface HTTPClient1<F extends URIS> extends MonadThrow1<F> {
		readonly request: (request: Request) => Kind<F, unknown>;
	}
	export interface HTTPClient2<F extends URIS2> extends MonadThrow2<F> {
		readonly request: (request: Request) => Kind2<F, unknown, unknown>;
	}
	
	export class ResponseValidationError extends Error {
		static create(errors: Errors): ResponseValidationError {
			return new ResponseValidationError(errors);
		}
	
		constructor(readonly errors: Errors) {
			super(PathReporter.report(left(errors)).join('\\n\\n'));
			this.name = 'ResponseValidationError';
			Object.setPrototypeOf(this, ResponseValidationError);
		}
	}
`;

export const clientFile = pipe(
	clientRef,
	either.map(ref => fromRef(ref, '.ts', client)),
);
