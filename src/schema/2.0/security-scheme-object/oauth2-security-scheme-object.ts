import * as t from 'io-ts';
import { ImplicitOAuth2SecuritySchemeObject } from './implicit-oauth2-security-scheme-object';
import { PasswordOAuth2SecuritySchemeObject } from './password-oauth2-security-scheme-object';
import { ApplicationOAuth2SecuritySchemeObject } from './application-oauth2-security-scheme-object';
import { AccessCodeOAuth2SecuritySchemeObject } from './access-code-oauth2-security-scheme-object';

export type OAuth2SecuritySchemeObject =
	| ImplicitOAuth2SecuritySchemeObject
	| PasswordOAuth2SecuritySchemeObject
	| ApplicationOAuth2SecuritySchemeObject
	| AccessCodeOAuth2SecuritySchemeObject;

export const OAuth2SecuritySchemeObject = t.union(
	[
		ImplicitOAuth2SecuritySchemeObject,
		PasswordOAuth2SecuritySchemeObject,
		ApplicationOAuth2SecuritySchemeObject,
		AccessCodeOAuth2SecuritySchemeObject,
	],
	'OAuth2SecuritySchemeObject',
);
