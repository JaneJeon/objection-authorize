# Objection-Authorize

[![CircleCI](https://img.shields.io/circleci/build/github/JaneJeon/objection-authorize)](https://circleci.com/gh/JaneJeon/objection-authorize) [![codecov](https://codecov.io/gh/JaneJeon/objection-authorize/branch/master/graph/badge.svg)](https://codecov.io/gh/JaneJeon/objection-authorize) [![Maintainability](https://api.codeclimate.com/v1/badges/78bae22810143ad84ef1/maintainability)](https://codeclimate.com/github/JaneJeon/objection-authorize/maintainability) [![NPM](https://img.shields.io/npm/v/objection-authorize)](https://www.npmjs.com/package/objection-authorize) [![Downloads](https://img.shields.io/npm/dt/objection-authorize)](https://www.npmjs.com/package/objection-authorize) [![install size](https://packagephobia.now.sh/badge?p=objection-authorize)](https://packagephobia.now.sh/result?p=objection-authorize) [![David](https://img.shields.io/david/JaneJeon/objection-authorize)](https://david-dm.org/JaneJeon/objection-authorize) [![Known Vulnerabilities](https://snyk.io//test/github/JaneJeon/objection-authorize/badge.svg?targetFile=package.json)](https://snyk.io//test/github/JaneJeon/objection-authorize?targetFile=package.json) [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=JaneJeon/objection-authorize)](https://dependabot.com) [![License](https://img.shields.io/npm/l/objection-authorize)](https://github.com/JaneJeon/objection-authorize/blob/master/LICENSE) [![Docs](https://img.shields.io/badge/docs-github-blue)](https://janejeon.github.io/objection-authorize)

"Magical" integration with Objection.js to provide baked-in authorization!

It automatically takes away a lot of the manual wiring that you'd need to do if you were to implement your access control on a request/route level, including:

- filtering request body
- checking the user against the resource and the ACL
- figuring out _which_ resource to check the user's grants against automatically(!)
- even filtering the result from a query according to a user's read access!

This plugin supports both `role-acl` and `accesscontrol` modules, along with any authorization framework that uses the following syntax to check access:

```js
acl
  .can(role)
  .execute(action)
  .context(ctx)
  .on(resource)
```

## Usage

Plugging in `objection-authorize` to work with your existing authorization setup is as easy as follows:

```js
const AccessControl = require('role-acl') // or
const AccessControl = require('accesscontrol')
const acl = new AccessControl(grants) // the grants object

const { Model } = require('objection')
const authorize = require('objection-authorize')(acl)

class Post extends authorize(Model) {
  // that's it! This is just a regular objection.js model class
}
```

Then, you can take your resource model and authorize requests like so:

```js
const post = await Post.query()
  .authorize(user)
  .create({ title: 'hello!' }) // authorize a POST request
await Post.query()
  .authorize(user, { authorId: 'jim' })
  .findById(1) // authorize a GET request
await post
  .$query()
  .authorize(user)
  .patch(body) // authorize a PATCH request
await post
  .$query()
  .authorize(user)
  .delete() // authorize a DELETE request
```

To authorize a request, a user and a resource must be specified. You pass the user as the first parameter of `authorize()`, and the resource as the second parameter.

Additionally, this plugin attempts to load the resource from the model instance, so if you've already fetched a resource and are calling `$query()` or `$relatedQuery()` to build a query, you don't even have to pass the resource object to `authorize()` manually!

```js
const post = await Post.query().findById(1)
await post
  .$query()
  .authorize(user) // resource param not needed
  .patch(body)
```

Furthermore, if you're creating a resource (i.e. `insert()`), then you do not have to specify the resource, though the result from the query will be filtered according to the user's read access.

In general, if your query returns a resource or a list of resources, then that result set will be filtered according to the user's read access.

For more examples, [see here](https://github.com/JaneJeon/objection-authorize/blob/master/index.test.js).

## Configuration

You can pass an options object as the second parameter in `objectionAuthorize(acl, opts)` when initializing the plugin. The options objects is structured as follows (the given values are the default):

```js
const opts = {
  defaultRole: 'anonymous',
  unauthenticatedErrorCode: 401,
  unauthorizedErrorCode: 403,
  resourceName: model => model.name,
  resourceAugments: { true: true, false: false },
  userFromResult: false
}
```

Additionally, you can override the settings on an individual query basis. Just pass the `opts` as the 3rd parameter of `authorize(user, resource, opts)` to override the "global" opts that you set while initializing the plugin _just_ for that query.

For explanations on what each option does, see below:

### defaultRole

When the user object is empty, a "default" user object will be created with the `defaultRole`.

### unauthenticatedErrorCode

Error code thrown when an unauthenticated user is not allowed to access a resource.

### unauthorizedErrorCode

Error code thrown when an authenticated user is not allowed to access a resource.

### resourceName

A function to extract resource name from a model class. The default is its raw name (**NOT** lowercased). For instance, if you're using a `Post` model class, your resource name would be `Post`.

### resourceArguments

Since neither role-acl nor accesscontrol allow you to _just_ check the request body (they don't parse the `$.foo.bar` syntax for the ACL rule keys), if you want to check _only_ the request, you need to put custom properties.

So the default allows checks such as `{Fn: 'EQUALS', args: {true: $.req.body.confirm}}` (useful when trying to require that a user confirm deletion of a resource, for example) by attaching the "true" and "false" values as part of the property of the resource!!

However, note that these properties will _overwrite_ the properties of the resource, so be sure to set this to null, {} or whatever when you're running on queries on such resource to avoid attribute name collision.

### userFromResult

There might be situations where a query (possibly) changes the requesting user itself. In that case, we need to update the user context in order to get accurate read access on the returning result.

For instance, if other people can't read a user's email address, when you create/update a user, the returning result might have the email address filtered out because the original user context was an anonymous user.

Set to `true` to "refresh" the user context, or pass a function to _ensure_ that the changed user IS the user that requested the query. The function takes in `(user, result)` and returns a `boolean`.

For example, you might use the function when admins can change a user's details, but the changed user _might_ be the admin itself or it could be someone different.

To ensure the admin only sees the email address when the changed user is actually the admin itself, you might want to pass a function checking that the requesting user IS the changed user, like this:

```js
const fn = (user, result) =>
  user instanceof Model && isEqual(user.$id(), result.$id())
```

## Authorizing requests

This works with any router framework (express/koa/fastify/etc) - all you need to do is to provide the requesting user (for example, `req.user` in express).

Here's an example of [how the plugin works with express](https://github.com/JaneJeon/express-objection-starter/blob/master/routes/users.js)
