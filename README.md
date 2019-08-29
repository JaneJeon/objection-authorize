# Objection-Authorize

[![CircleCI](https://circleci.com/gh/JaneJeon/objection-authorize.svg?style=shield)](https://circleci.com/gh/JaneJeon/objection-authorize) [![Coverage Status](https://coveralls.io/repos/github/JaneJeon/objection-authorize/badge.svg?branch=master)](https://coveralls.io/github/JaneJeon/objection-authorize?branch=master) [![npm version](https://badge.fury.io/js/objection-authorize.svg)](https://badge.fury.io/js/objection-authorize) [![install size](https://packagephobia.now.sh/badge?p=objection-authorize)](https://packagephobia.now.sh/result?p=objection-authorize) ![David](https://img.shields.io/david/JaneJeon/objection-authorize) [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=JaneJeon/objection-authorize)](https://dependabot.com) ![NPM](https://img.shields.io/npm/l/objection-authorize)

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
const AccessControl = require("role-acl") // or
const AccessControl = require("accesscontrol")
const acl = new AccessControl(grants) // the grants object

const { Model } = require("objection")
const authorize = require("objection-authorize")(acl)

class Post extends authorize(Model) {
  // that's it! This is just a regular objection.js model class
}
```

Then, you can take your resource model and authorize requests like so:

```js
const post = await Post.query()
  .authorize(user)
  .create({ title: "hello!" }) // authorize a POST request
await Post.query()
  .authorize(user, { authorId: "jim" })
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
{
  defaultRole: "anonymous" // when the user object is empty, a "default" user object will be created with the specified role
}
```

Additionally, in your grants object, be sure to name your resources as the same as the class name. For instance, if you're using a `Post` model class, then in your grants, you should name your resource `Post` as well.

## Authorizing requests

This works with any router framework (express/koa/fastify/etc) - all you need to do is to provide the requesting user (for example, `req.user` might be filled in by passport).

Here's an example of [how the plugin works with express](https://github.com/JaneJeon/express-objection-starter/blob/master/routes/users.js)
