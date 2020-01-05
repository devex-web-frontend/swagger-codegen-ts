import { directory, Directory } from '../../../../utils/fs';
import { pipe } from 'fp-ts/lib/pipeable';
import { serializeDefinitions } from './definitions-object';
import { serializePaths } from './paths-object';
import { pathsRef } from '../../common/utils';
import { Either } from 'fp-ts/lib/Either';
import { array, either, option } from 'fp-ts';
import { combineEither, sequenceEither } from '@devexperts/utils/dist/adt/either.utils';
import { SwaggerObject } from '../../../../schema/2.0/swagger-object';
import { fromString } from '../../../../utils/ref';
import { clientFile } from '../../common/bundled/client';
import { serializeParametersDefinitionsObject } from './parameters-definitions-object';
import { combineReader } from '@devexperts/utils/dist/adt/reader.utils';
import { serializeResponsesDefinitionsObject } from './responses-definitions-object';

const definitionsRef = fromString('#/definitions');
const parametersRef = fromString('#/parameters');
const responsesRef = fromString('#/responses');

export const serializeSwaggerObject = combineReader(
	serializePaths,
	serializePaths => (name: string, swaggerObject: SwaggerObject): Either<Error, Directory> => {
		const definitions = pipe(
			swaggerObject.definitions,
			option.map(definitions =>
				pipe(
					definitionsRef,
					either.chain(from => serializeDefinitions(from, definitions)),
				),
			),
		);
		const parameters = pipe(
			swaggerObject.parameters,
			option.map(parameters =>
				pipe(
					parametersRef,
					either.chain(ref => serializeParametersDefinitionsObject(ref, parameters)),
				),
			),
		);
		const responses = pipe(
			swaggerObject.responses,
			option.map(responses =>
				pipe(
					responsesRef,
					either.chain(ref => serializeResponsesDefinitionsObject(ref, responses)),
				),
			),
		);
		const additional = pipe([definitions, parameters, responses], array.compact, sequenceEither);
		const paths = pipe(
			pathsRef,
			either.chain(from => serializePaths(from, swaggerObject.paths)),
		);
		return combineEither(additional, paths, clientFile, (additional, paths, clientFile) =>
			directory(name, [clientFile, ...additional, paths]),
		);
	},
);
