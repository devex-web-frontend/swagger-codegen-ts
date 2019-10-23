import { isNonEmptyArraySchemaObject, serializeNonArraySchemaObject, serializeSchemaObject } from '../schema-object';
import { OpenAPIV3 } from 'openapi-types';
import { getSerializedArrayType, getSerializedRefType, serializedType } from '../../../common/data/serialized-type';
import { serializedDependency } from '../../../common/data/serialized-dependency';
import { isLeft, right } from 'fp-ts/lib/Either';
import { assert, constant, constantFrom, property, record, string } from 'fast-check';
import { $refArbitrary } from '../../../../../utils/__tests__/ref.spec';
import { pipe } from 'fp-ts/lib/pipeable';
import { either } from 'fp-ts';
import { arbitrary } from '../../../../../utils/fast-check';
import { fromString } from '../../../../../utils/ref';
import { fromEither } from 'fp-ts/lib/Option';

const primitiveTypes: OpenAPIV3.NonArraySchemaObject['type'][] = ['null', 'boolean', 'number', 'string', 'integer'];

describe('SchemaObject', () => {
	describe('isNonEmptyArraySchemaObject', () => {
		it('should detect', () => {
			assert(
				property(constantFrom(...primitiveTypes), type =>
					expect(isNonEmptyArraySchemaObject({ type })).toBeTruthy(),
				),
			);
			expect(isNonEmptyArraySchemaObject({ type: 'object' })).toBeTruthy();
			expect(isNonEmptyArraySchemaObject({ type: 'array', items: { $ref: '' } })).toBeFalsy();
		});
	});
	describe('serializeNonArraySchemaObject', () => {
		it('should fail for objects', () => {
			expect(isLeft(serializeNonArraySchemaObject({ type: 'object' }))).toBeTruthy();
		});
		describe('should serialize', () => {
			it('null', () => {
				expect(serializeNonArraySchemaObject({ type: 'null' })).toEqual(
					right(serializedType('null', 'literal(null)', [serializedDependency('literal', 'io-ts')], [])),
				);
			});
			it('string', () => {
				expect(serializeNonArraySchemaObject({ type: 'string' })).toEqual(
					right(serializedType('string', 'string', [serializedDependency('string', 'io-ts')], [])),
				);
			});
			it('boolean', () => {
				expect(serializeNonArraySchemaObject({ type: 'boolean' })).toEqual(
					right(serializedType('boolean', 'boolean', [serializedDependency('boolean', 'io-ts')], [])),
				);
			});
			it('integer', () => {
				expect(serializeNonArraySchemaObject({ type: 'integer' })).toEqual(
					right(serializedType('number', 'number', [serializedDependency('number', 'io-ts')], [])),
				);
			});
			it('number', () => {
				expect(serializeNonArraySchemaObject({ type: 'number' })).toEqual(
					right(serializedType('number', 'number', [serializedDependency('number', 'io-ts')], [])),
				);
			});
		});
	});
	describe('serializeSchemaObject', () => {
		const rootName = string();
		const cwd = string();
		it('should use serializeNonArraySchemaObject for primitives', () => {
			const schema = constantFrom(...primitiveTypes).map(type => ({ type }));
			assert(
				property($refArbitrary, schema, (from, schema) => {
					expect(serializeSchemaObject(from)(schema)).toEqual(serializeNonArraySchemaObject(schema));
				}),
			);
		});
		describe('array', () => {
			it('should serialize using getSerializedArrayType', () => {
				const schema = record({
					type: constant<'array'>('array'),
					items: record({
						type: constant<'string'>('string'),
					}),
				});
				assert(
					property($refArbitrary, schema, (from, schema) => {
						const expected = pipe(
							schema.items,
							serializeSchemaObject(from),
							either.map(getSerializedArrayType),
						);
						const serialized = pipe(
							schema,
							serializeSchemaObject(from),
						);
						expect(serialized).toEqual(expected);
					}),
				);
			});
			it('should support items.$ref', () => {
				assert(
					property($refArbitrary, $refArbitrary, (from, $refArbitrary) => {
						const schema: OpenAPIV3.SchemaObject = {
							type: 'array',
							items: {
								$ref: $refArbitrary.$ref,
							},
						};
						const expected = pipe(
							$refArbitrary,
							getSerializedRefType(from),
							getSerializedArrayType,
						);
						expect(serializeSchemaObject(from)(schema)).toEqual(right(expected));
					}),
				);
			});
		});
		xdescribe('recursive', () => {
			describe('local', () => {
				it('self', () => {
					const $ref = pipe(
						rootName,
						arbitrary.map(name => `#/components/schemas/${name}`),
						arbitrary.filterMap(s => fromEither(fromString(s))),
					);
					const schema = record({
						type: constant<'object'>('object'),
						properties: record({
							children: record({
								$ref: $ref.map(r => r.$ref),
							}),
						}),
						required: constant(['children']),
					});
					assert(
						property(schema, rootName, $refArbitrary, $ref, (schema, rootName, from, $ref) => {
							const serialized = serializeSchemaObject(from)(schema);
							const expected = serializedType(
								`{ children: Array<${rootName}> }`,
								`recursion<${rootName}, unknown>(R => type({ children: array(R) }) )`,
								[
									serializedDependency('recursion', 'io-ts'),
									serializedDependency('type', 'io-ts'),
									serializedDependency('array', 'io-ts'),
								],
								[$ref],
							);
							expect(serialized).toEqual(right(expected));
						}),
					);
				});
			});
		});
	});
});
