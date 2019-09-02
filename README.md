# Objection-Authorize

[![CircleCI](https://img.shields.io/circleci/build/github/JaneJeon/objection-authorize)](https://circleci.com/gh/JaneJeon/objection-authorize) [![Coverage Status](https://coveralls.io/repos/github/JaneJeon/objection-authorize/badge.svg?branch=master)](https://coveralls.io/github/JaneJeon/objection-authorize?branch=master) [![npm](https://img.shields.io/npm/v/objection-authorize)](https://www.npmjs.com/package/objection-authorize) [![install size](https://packagephobia.now.sh/badge?p=objection-authorize)](https://packagephobia.now.sh/result?p=objection-authorize) [![David](https://img.shields.io/david/JaneJeon/objection-authorize)](https://david-dm.org/JaneJeon/objection-authorize) [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=JaneJeon/objection-authorize)](https://dependabot.com) [![NPM](https://img.shields.io/npm/l/objection-authorize)](https://github.com/JaneJeon/objection-authorize/blob/master/LICENSE)

"Magical" integration with Objection.js to provide baked-in authorization!

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

Furthermore, if you're creating a resource (i.e. `insert()`), then you do not have to specify the resource, though the result from the query will be filtered according to the user's read access.

In general, if your query returns a resource or a list of resources, then that result set will be filtered according to the user's read access.

For more examples, [see here](https://github.com/JaneJeon/objection-authorize/blob/master/index.test.js).

## Configuration

You can pass an options object as the second parameter in `authorize(acl, opts)`. The options objects is structured as follows (the given values are the default):

```js
const opts = {
  // when the user object is empty, a "default" user object will be created with the specified role
  defaultRole: 'anonymous',
  // error code thrown when an unauthenticated user is not allowed to access a resource
  unauthenticatedErrorCode: 401,
  // error code thrown when an authenticated user is not allowed to access a resource
  unauthorizedErrorCode: 403,
  // extract resource name from a model class. The default is its raw name (NOT lowercased).
  // for instance, if you're using a `Post` model class, your resource name would be `Post`.
  resourceName: model => model.name,
  // since neither role-acl nor accesscontrol allow you to *just* check the request body
  // (they don't parse the $.foo.bar syntax for the ACL rule keys), if you want to check
  // only the request, you need to put custom properties.
  // So the default below allows checks such as {Fn: 'EQUALS', args: {true: req.body.confirm}}
  // by attaching the "true" and "false" values as part of the property of the resource!!
  // However, note that these properties will *overwrite* the properties of the resource,
  // so be sure to set this to null, {} or whatever when you're running on queries on such resource
  resourceAugments: { true: true, false: false },
  // there might be situations where a query (possibly) changes the requesting user itself.
  // In that case, we need to update the user context in order to get accurate read access
  // on the returning result. For instance, if other people can't read a user's email address,
  // when you create/update a user, the returning result might have the email address filtered out
  // because the original user context was an anonymous user.
  // Set to true to "refresh" the user context, or pass a function to *ensure* that the changed
  // user IS the user that requested the query. The function takes in (user, result) and returns
  // a bolean. For example, you might use the function when admins can change a user's details,
  // but the changed user *might* be the admin itself or it could be someone different.
  // To ensure the admin only sees the email address when the changed user is actually the admin itself, you might want to pass a function checking that the requesting user IS the changed user:
  // (user, result) => user instanceof Model && isEqual(user.$id(), result.$id())
  userFromResult: false
}
```

Additionally, you can override the settings on an individual query basis. Just pass the `opts` as the 3rd parameter of `authorize(user, resource, opts)` to override the "global" opts that you set while initializing the plugin _just_ for that query.

## Authorizing requests

This works with any router framework (express/koa/fastify/etc) - all you need to do is to provide the requesting user (for example, `req.user` in express).

Here's an example of [how the plugin works with express](https://github.com/JaneJeon/express-objection-starter/blob/master/routes/users.js)
