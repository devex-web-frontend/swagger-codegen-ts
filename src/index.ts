import { SwaggerObject } from './schema/2.0/swagger';
import * as prettier from 'prettier';
import { map, read, FSEntity, write } from './fs';
import { Serializer } from './utils';
import * as fs from 'fs-extra';
import { fromNullable, getOrElse, Option, map as mapOption } from 'fp-ts/lib/Option';
import * as path from 'path';
import { head, last } from 'fp-ts/lib/Array';
import { FileReader } from './fileReader';
import { isLeft, Right } from 'fp-ts/lib/Either';
import * as del from 'del';
import { pipe } from 'fp-ts/lib/pipeable';
import { ThrowReporter } from 'io-ts/lib/ThrowReporter';
import { PathReporter } from 'io-ts/lib/PathReporter';

const log = console.log.bind(console, '[SWAGGER-CODEGEN-TS]:');

export interface GenerateOptions {
	/**
	 * Paths to spec files
	 */
	pathsToSpec: string[];
	/**
	 * Path to output directory (should be empty)
	 */
	out: string;
	/**
	 * Spec serializer
	 */
	serialize: Serializer;
	/**
	 * Path to prettier config
	 */
	pathToPrettierConfig?: string;
	/**
	 * Buffer to JSON converter
	 * @param buffer - File Buffer
	 */
	fileReader: FileReader;
}

const cwd = process.cwd();
const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.resolve(cwd, p));

const serializeDecode = (serializer: Serializer) => async (
	decoded: Right<SwaggerObject>,
	out: string,
): Promise<FSEntity> => serializer(path.basename(out), decoded.right);

const getPrettierConfig = async (pathToPrettierConfig?: string): Promise<Option<prettier.Options>> =>
	fromNullable(
		await prettier.resolveConfig(
			pipe(
				fromNullable(pathToPrettierConfig),
				mapOption(resolvePath),
				getOrElse(() => path.resolve(__dirname, '../.prettierrc')),
			),
		),
	);

const formatSerialized = (serialized: FSEntity, prettierConfig: Option<prettier.Options>): FSEntity =>
	pipe(
		prettierConfig,
		mapOption(config => map(serialized, content => prettier.format(content, config))),
		getOrElse(() => serialized),
	);

const writeFormatted = (out: string, formatted: FSEntity) => write(path.dirname(out), formatted);

export const generate = async (options: GenerateOptions): Promise<void> => {
	const out = resolvePath(options.out);
	const isPathExist = await fs.pathExists(out);

	if (isPathExist) {
		await del(out);
	}
	await fs.mkdirp(out);
	const prettierConfig = await getPrettierConfig(options.pathToPrettierConfig);
	const serializer = serializeDecode(options.serialize);

	for (const pathToFile of options.pathsToSpec) {
		const pathToSpec = resolvePath(pathToFile);
		const buffer = await read(pathToSpec, cwd);
		const dirName = pipe(
			head(buffer.fileName.split('.')),
			getOrElse(() => buffer.fileName),
		);
		const apiOut = path.resolve(out, `./${dirName}`);
		await fs.mkdir(apiOut);
		const json = options.fileReader(buffer.buffer);
		const decoded = SwaggerObject.decode(json);
		if (isLeft(decoded)) {
			const report = PathReporter.report(decoded);
			const lastReport = last(report);
			log(
				pipe(
					lastReport,
					getOrElse(() => 'Invalid spec'),
				),
			);
			ThrowReporter.report(decoded);
			return;
		}
		const seralized = await serializer(decoded, apiOut);
		const formatted = formatSerialized(seralized, prettierConfig);
		writeFormatted(apiOut, formatted);
	}
};
