import { AsyncAPIObject } from '../../../../schema/asyncapi-2.0.0/asyncapi-object';
import { Either } from 'fp-ts/lib/Either';
import { directory, FSEntity } from '../../../../utils/fs';
import { combineReader } from '@devexperts/utils/dist/adt/reader.utils';
import { serializeComponentsObject } from './components-object';
import { fromString } from '../../../../utils/ref';
import { pipe } from 'fp-ts/lib/pipeable';
import { array, either, option } from 'fp-ts';
import { combineEither, sequenceEither } from '@devexperts/utils/dist/adt/either.utils';
import { serializeChannelsObject } from './channels-object';
import { clientFile } from '../../common/bundled/client';

export const serializeAsyncAPIObject = combineReader(
	serializeComponentsObject,
	serializeComponentsObject => (name: string, asyncAPIObject: AsyncAPIObject): Either<Error, FSEntity> => {
		const components = pipe(
			asyncAPIObject.components,
			option.map(components =>
				pipe(
					fromString('#/components'),
					either.chain(from => serializeComponentsObject(from, components)),
					either.map(content => directory('components', [content])),
				),
			),
		);
		const additional = pipe(array.compact([components]), sequenceEither);
		const channels = pipe(
			fromString('#/channels'),
			either.chain(from => serializeChannelsObject(from, asyncAPIObject.channels)),
			either.map(content => directory('channels', [content])),
		);
		return combineEither(channels, additional, clientFile, (channels, additional, clientFile) =>
			directory(name, [channels, clientFile, ...additional]),
		);
	},
);
