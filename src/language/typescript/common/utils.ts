import { SerializedPathParameter } from './data/serialized-path-parameter';
import { unless } from '../../../utils/string';
import { Options } from 'prettier';
import { fromString, ResolveRefContext } from '../../../utils/ref';
import { Kind } from '../../../utils/types';
import { ask } from 'fp-ts/lib/Reader';
import { pipe } from 'fp-ts/lib/pipeable';
import { keys } from 'fp-ts/lib/Record';
import { array, option } from 'fp-ts';

export const SUCCESSFUL_CODES = ['200', '201', 'default'];
export const CONTROLLERS_DIRECTORY = 'controllers';
export const DEFINITIONS_DIRECTORY = 'definitions';
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type XHRResponseType = 'json' | 'blob' | 'text';
const INVALID_NAMES = ['Error', 'Promise', 'PromiseLike', 'Array', 'ArrayLike', 'Function', 'Object'];
const TYPE_NAME_NORMALIZE_REGEX = /\W/g;
const normalize = (name: string): string => name.replace(TYPE_NAME_NORMALIZE_REGEX, '_').replace(/^(\d)/, '_$1');
export const getTypeName = (name: string): string => {
	if (name.length === 0) {
		return 'Type';
	}
	const normalized = normalize(name);
	return INVALID_NAMES.includes(name) ? `${normalized}Type` : normalized;
};
export const getIOName = (name: string): string => `${normalize(name)}IO`;
export const getURL = (pattern: string, pathParameters: SerializedPathParameter[]): string =>
	pathParameters.reduce(
		(acc, p) => acc.replace(`{${p.name}}`, `\$\{encodeURIComponent(${p.io}.toString())\}`),
		`\`${pattern}\``,
	);
export const getJSDoc = (lines: string[]): string =>
	unless(
		lines.length === 0,
		`/**
			 ${lines.map(line => `* ${line}`).join('\n')}
		 */`,
	);
export const defaultPrettierConfig: Options = {
	bracketSpacing: true,
	jsxBracketSameLine: true,
	parser: 'typescript',
	printWidth: 120,
	semi: true,
	singleQuote: true,
	tabWidth: 4,
	trailingComma: 'all',
	useTabs: true,
};

export interface SerializeOptions {
	prettierConfig?: Options;
}

export const pathsRef = fromString('#/paths');

export const getKindValue = (kind: Kind, value: string): string => {
	switch (kind) {
		case 'HKT': {
			return `HKT<F, ${value}>`;
		}
		case '*': {
			return `Kind<F, ${value}>`;
		}
		case '* -> *': {
			return `Kind2<F, Error, ${value}>`;
		}
	}
};

export const getControllerName = (name: string): string => `${name}Controller`;

const COMMENT_PATTERN = /\/\*(.*)\*\//;
const REPLACE_COMMENT_PATTERN = new RegExp(COMMENT_PATTERN, 'g');
export const escapeCommpent = (value: string) => value.replace(REPLACE_COMMENT_PATTERN, '\\/*$1*\\/');

export const UNSAFE_PROPERTY_PATTERN = /[^a-zA-Z_0-9]/;
const REPLACE_PATTERN = new RegExp(UNSAFE_PROPERTY_PATTERN, 'g');
export const getSafePropertyName = (value: string): string =>
	value.replace(REPLACE_PATTERN, '_').replace(/^(\d)/, '_$1') || '_';

export const context = ask<ResolveRefContext>();

export const getKeyMatchValue = <T extends string, A>(record: Record<T, A>, regexp: RegExp) =>
	pipe(
		record,
		keys,
		array.findFirst(s => regexp.test(s)),
		option.map(key => ({ key, value: record[key] })),
	);

const blobMediaRegexp = /^(video|audio|image|application)/;
const textMediaRegexp = /^text/;
export const DEFAULT_MEDIA_TYPE = 'application/json';
export const getResponseTypeFromMediaType = (mediaType: string): XHRResponseType => {
	if (mediaType === 'application/json') {
		return 'json';
	}
	if (blobMediaRegexp.test(mediaType)) {
		return 'blob';
	}
	if (textMediaRegexp.test(mediaType)) {
		return 'text';
	}
	return 'json';
};
