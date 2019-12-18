import { Either } from 'fp-ts/lib/Either';
import { Document } from '../../../../schema/sketch-121/document';
import { serializeSharedStyleContainer } from './objects/shared-styled-container';
import { pipe } from 'fp-ts/lib/pipeable';
import { array, either, nonEmptyArray, option } from 'fp-ts';
import { combineEither } from '@devexperts/utils/dist/adt/either.utils';
import { combineReader } from '@devexperts/utils/dist/adt/reader.utils';
import { serializeSharedTextStyleContainer } from './objects/shared-text-style-container';
import { serializeForeignLayerStyle } from './objects/foreign-layer-style';
import { traverseNEAEither } from '../../../../utils/either';
import { sequenceOptionEither } from '../../../../utils/option';
import { serializeForeignTextStyle } from './objects/foreign-text-style';
import { Option } from 'fp-ts/lib/Option';
import { file, fragment, FSEntity } from '../../../../utils/fs';
import { serializeAssetCollection } from './objects/asset-collection';
import { serializePage } from './pages/page';

export const serializeDocument = combineReader(
	serializeSharedStyleContainer,
	serializeSharedTextStyleContainer,
	serializeForeignLayerStyle,
	serializeForeignTextStyle,
	serializeAssetCollection,
	serializePage,
	(
		serializeSharedStyleContainer,
		serializeSharedTextStyleContainer,
		serializeForeignLayerStyle,
		serializeForeignTextStyle,
		serializeAssetCollection,
		serializePage,
	) => (document: Document): Either<Error, Option<FSEntity>> => {
		const layerStyles = pipe(
			serializeSharedStyleContainer(document.layerStyles),
			either.map(option.map(content => file('layer-styles.ts', content))),
		);
		const layerTextStyles = pipe(
			serializeSharedTextStyleContainer(document.layerTextStyles),
			either.map(option.map(content => file('layer-text-styles.ts', content))),
		);

		const foreignLayerStyles = pipe(
			nonEmptyArray.fromArray(document.foreignLayerStyles),
			option.map(styles =>
				pipe(
					traverseNEAEither(styles, serializeForeignLayerStyle),
					either.map(styles => file('foreign-layer-styles.ts', styles.join(''))),
				),
			),
			sequenceOptionEither,
		);
		const foreignTextStyles = pipe(
			nonEmptyArray.fromArray(document.foreignTextStyles),
			option.map(styles =>
				pipe(
					traverseNEAEither(styles, serializeForeignTextStyle),
					either.map(styles => file('foreign-text-styles.ts', styles.join(''))),
				),
			),
			sequenceOptionEither,
		);

		const assets = pipe(
			serializeAssetCollection(document.assets),
			either.map(option.map(assets => file('assets.ts', assets))),
		);

		const layers = pipe(
			nonEmptyArray.fromArray(document.pages),
			option.map(pages =>
				pipe(
					traverseNEAEither(pages, serializePage),
					either.map(pagesLayers => file('layers.ts', pagesLayers.join(''))),
				),
			),
			sequenceOptionEither,
		);

		return combineEither(
			layerStyles,
			layerTextStyles,
			foreignLayerStyles,
			foreignTextStyles,
			assets,
			layers,
			(layerStyles, layerTextStyles, foreignLayerStyles, foreignTextStyles, assets, layers) =>
				pipe(
					nonEmptyArray.fromArray(
						array.compact([
							layerStyles,
							layerTextStyles,
							foreignLayerStyles,
							foreignTextStyles,
							assets,
							layers,
						]),
					),
					option.map(fragment),
				),
		);
	},
);
