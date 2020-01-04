<h1 align="center">Welcome to objection-authorize 👋</h1>

[![CircleCI](https://img.shields.io/circleci/build/github/JaneJeon/objection-authorize)](https://circleci.com/gh/JaneJeon/objection-authorize)
[![codecov](https://codecov.io/gh/JaneJeon/objection-authorize/branch/master/graph/badge.svg)](https://codecov.io/gh/JaneJeon/objection-authorize)
[![NPM](https://img.shields.io/npm/v/objection-authorize)](https://www.npmjs.com/package/objection-authorize)
[![Downloads](https://img.shields.io/npm/dt/objection-authorize)](https://www.npmjs.com/package/objection-authorize)
[![install size](https://packagephobia.now.sh/badge?p=objection-authorize)](https://packagephobia.now.sh/result?p=objection-authorize)
[![David](https://img.shields.io/david/JaneJeon/objection-authorize)](https://david-dm.org/JaneJeon/objection-authorize)
[![Known Vulnerabilities](https://snyk.io//test/github/JaneJeon/objection-authorize/badge.svg?targetFile=package.json)](https://snyk.io//test/github/JaneJeon/objection-authorize?targetFile=package.json)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=JaneJeon/objection-authorize)](https://dependabot.com)
[![License](https://img.shields.io/npm/l/objection-authorize)](https://github.com/JaneJeon/objection-authorize/blob/master/LICENSE)
[![Docs](https://img.shields.io/badge/docs-github-blue)](https://janejeon.github.io/objection-authorize)
[![Standard code style](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Prettier code style](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> isomorphic, &#34;magical&#34; access control integrated with objection.js

It automatically takes away a lot of the manual wiring that you'd need to do if you were to implement your access control on a request/route level, including:

- checking the user against the resource and the ACL
- filtering request body according to the action and the user's access
- figuring out _which_ resource to check the user's grants against automatically(!)
- even filtering the result from a query according to a user's read access!

Not sure why you would need this? Read below for examples or [see here](https://janejeon.dev/integrating-access-control-to-your-node-js-apps) to learn just how complex access control can be and how you can manage said complexity with this plugin!

### 🏠 [Homepage](https://github.com/JaneJeon/objection-authorize)

## Install

To install the library itself:

```sh
yarn add objection objection-authorize # or
npm install objection objection-authorize --save
```

And you can install either [role-acl](https://github.com/tensult/role-acl) or [@casl/ability](https://github.com/stalniy/casl) as your authorization framework. Note that `role-acl>=4 <4.3.2` (that is every v4 release before v4.3.2) is NOT supported as the library author just dropped synchronous acl support overnight.

## Changelog

Starting from the 1.0 release, all changes will be documented at the [releases page](https://github.com/JaneJeon/objection-authorize/releases).

## Usage

Plugging in `objection-authorize` to work with your existing authorization setup is as easy as follows:

```js
const acl = ... // see below for defining acl

const { Model } = require('objection')
const authorize = require('objection-authorize')(acl, library, opts) // choose role-acl@3, role-acl@4, or casl for library

class Post extends authorize(Model) {
  // that's it! This is just a regular objection.js model class
}
```

And that adds a "magic" `authorize(user, resource, opts)` method that can be chained to provide access control and authorize requests.

Calling this method will:

1. check that a user is allowed to perform an action based on the acl, resource, action, body, & the user and throw an error if they're not allowed to.
2. filter the request body (i.e. the thing you pass to `create()/update()/delete()`) according to the user's access (this is not relevant for GET operations)
3. if there's a returning result (e.g. you called `.returning('*')` or `(insert|update)AndFetch(byId)`), filters that according to a user's read access

Note that the method must be called _before_ any insert/patch/update/delete calls:

```js
const post = await Post.query()
  .authorize(user, resource, opts)
  .insertAndFetch({ title: 'hello!' }) // authorize a POST request
await Post.query()
  .authorize(user, resource, opts)
  .findById(1) // authorize a GET request
await post
  .$query()
  .authorize(user, resource, opts)
  .patch(body)
  .returning('*') // authorize a PATCH request
await post
  .$query()
  .authorize(user, resource, opts)
  .delete() // authorize a DELETE request
// it's THAT simple!
```

## Resource

A resource can be a plain object or an instance of a `Model` class (or any of its subclasses) that specifies _what_ the user is trying to access.

In absence of the `resource` parameter in `authorize(user, resource, opts)`, this plugin attempts to load the resource from the model instance, so if you've already fetched a resource and are calling `$query()` to build a query, that will be used as the resource automatically:

```js
const post = await Post.query().findById(1)
await post
  .$query()
  .authorize(user) // resource param not needed
  .patch(body)
```

And when all else has failed, the plugin looks at the resulting object for the resource:

```js
await Post.query()
  .authorize(user) // resource defaults to the result of this Post query
  .findById(1)
```

Furthermore, if you're creating a resource (i.e. `insert()`), you do not have to specify the resource, though the result from the query will be filtered according to the user's read access.

In general, you do not have to specify the resource parameter unless you want to force the plugin into using a particular resource.

[See here for more examples](https://github.com/JaneJeon/objection-authorize/blob/master/test/utils/plugin-test.js).

## Defining the ACL

### role-acl

For `role-acl`, just define the acl as you normally would. Note that you're meant to pass the formed acl instead of the grants object:

```js
const RoleAcl = require('role-acl')
const acl = new RoleAcl(grants) // if you have a grants object, or
const acl = new RoleAcl()
acl
  .grant('user')
  .execute('create')
  .on('Video') // just chain it as usual
```

### @casl/ability

For `casl`, because it doesn't allow dynamically checking against any resource or action, we have to wrap it with a function, and that function takes in `(user, resource, action, body, opts)` and returns an _instance_ of ability.

This is essentially the same as the `defineAbilitiesFor(user)` method described [in the casl docs](https://stalniy.github.io/casl/abilities/2017/07/20/define-abilities.html), but obviously with a lot more context.

So you might define your ability like this (and it doesn't matter if you use `AbilityBuilder` or `Ability`):

```js
const { AbilityBuilder } = require('@casl/ability')

function acl (user, resource, action, body, opts) {
  return AbilityBuilder.define((allow, forbid) => {
    if (user.isAdmin()) {
      allow('manage', 'all')
    } else {
      allow('read', 'all')
    }
  })
}
```

If you want to cut down on the time it takes to check access, one thing you might want to do is to use the `resource` parameter to ONLY define rules relevant to that resource:

```js
function acl (user, resource, action, body, opts) {
  return AbilityBuilder.define((allow, forbid) => {
    switch (resource.constructor.name) {
      case 'User':
        allow('read', 'User')
        forbid('read', 'User', ['email'])
        break
      case 'Post':
        allow('create', 'Post')
        forbid('read', 'Post', { private: true })
    }
  })
}
```

### Note on Resource Names

_For both libraries_, note that the resource name IS the corresponding model's name. So if you have a model class `Post`, you should be referring to that resource as `Post` and not `post` in your ACL definition.

### Note on Sharing the ACL between frontend and the backend

The resources that are passed to this plugin in the backend are typically going to be wrapped in their respective model classes: e.g. `req.user` typically will be an instance of the `User` class, and the resource will _always_ be wrapped with its respective class.

So if you want to share your ACL between frontend and the backend, as the frontend doesn't have access to Objection models, any transformation you have on your models should be _symmetric_.

For example, if you have `user.id` and `post.creatorId` and you hash ID's when you export it to JSON, you want to make sure if `user.id = post.creatorId = 1`, the transformed values are _also_ the same (`user.id = post.creatorId = XYZ`, for example).

This also means that you _shouldn't_ rely on virtuals and asymmetrically-transformed fields on your ACL (if you want to use your ACL on the frontend, that is).

## Authorization Context (for role-acl only)

Due to the limitations of `role-acl`, authorization context (i.e. the right side of access condition arguments) combines the actual resource object, requester, the query object (the stuff you pass to `Model.query().update(obj)` and the likes), resource argument options (global and local) into one object.

This does mean that there's a potential for key conflicts. In that case, the precedence is as follows:

1. The resource object (attached to top level; its fields are accessible directly by `$.$field`)
2. The query-level/local resource arguments (ditto)
3. The plugin-level/global resource arguments (ditto)
4. Requester/query object (attached under the `req` key: accessible by `$.req.user.$field` and `$.req.body.$field`).

So if resource (priority 1) had a property called `req`, then the requester and query object (priority 2) would be overwritten and be inaccessible under `$.req.(user|body)`.

## Options

You can pass an options object as the second parameter in `objectionAuthorize(acl, opts)` when initializing the plugin. The options objects is structured as follows (the given values are the default):

```js
const opts = {
  defaultRole: 'anonymous',
  unauthenticatedErrorCode: 401,
  unauthorizedErrorCode: 403,
  userFromResult: false,
  // below are role-acl specific options
  contextKey: 'req',
  roleFromUser: user => user.role,
  resourceAugments: { true: true, false: false, undefined: undefined }
}
```

Additionally, you can override the settings on an individual query basis. Just pass the `opts` as the 3rd parameter of `authorize(user, resource, opts)` to override the "global" opts that you set while initializing the plugin _just_ for that query.

For explanations on what each option does, see below:

<details>
<summary>defaultRole</summary>

When the user object is empty, a "default" user object will be created with the `defaultRole`.

</details>

<details>
<summary>unauthenticatedErrorCode</summary>

Error code thrown when an unauthenticated user is not allowed to access a resource.

</details>

<details>
<summary>unauthorizedErrorCode</summary>

Error code thrown when an authenticated user is not allowed to access a resource.

</details>

<details>
<summary>userFromResult</summary>

There might be situations where a query (possibly) changes the requesting user itself. In that case, we need to update the user context in order to get accurate read access on the returning result.

For instance, if other people can't read a user's email address, when you create/update a user, the returning result might have the email address filtered out because the original user context was an anonymous user.

Set to `true` to "refresh" the user context, or pass a function to _ensure_ that the changed user IS the user that requested the query. The function takes in `(user, result)` and returns a `boolean`.

For example, you might use the function when admins can change a user's details, but the changed user _might_ be the admin itself or it could be someone different.

To ensure the admin only sees the email address when the changed user is actually the admin itself, you might want to pass a function checking that the requesting user IS the changed user, like this:

```js
const fn = (user, result) =>
  user instanceof Model && isEqual(user.$id(), result.$id())
```

</details>

<details>
<summary>contextKey</summary>

As we gather various context (e.g. user, body, etc) throughout the query building process, we need to mount them to some key at the end, so you can access them via `$.req.user`, for example.

</details>

<details>
<summary>roleFromUser</summary>

With `casl`, because we're wrapping the acl in a function, we can extract the role from the user however we'd like. However, for `role-acl`, we need to extract a single string. This option is here just in case you have user role under a different key than `user.role`.

</details>

<details>
<summary>resourceAugments</summary>

Since neither role-acl nor accesscontrol allow you to _just_ check the request body (they don't parse the `$.foo.bar` syntax for the ACL rule keys), if you want to check _only_ the request, you need to put custom properties.

So the default allows checks such as `{Fn: 'EQUALS', args: {true: $.req.body.confirm}}` (useful when trying to require that a user confirm deletion of a resource, for example) by attaching the "true" and "false" values as part of the property of the resource!!

</details>

### Specifying action per query

In addition to the above options, you can also specify the action per query. This is useful when you have custom actions in your ACL (such as `promote`). Just chain a `.action(customAction)` to the query and that will override the default action (`create`/`read`/`update`/`delete`) when checking access!

## Authorizing requests

This works with any router framework (express/koa/fastify/etc) - all you need to do is to provide the requesting user. So instead of `user` in the above examples, you would replace it with `req.user` (for express, for example).

This plugin is agnostic about your choice of authentication - doesn't matter if it's `req.user` or `ctx.user`, or if you're using sessions or JWTs, or if you're using passportjs or something else, all it needs is a user and a resource (optional).

Here's how it might work with express:

```js
app
  // for this request, you might want to show the email only if the user is requesting itself
  .get('/users/:username', async (req, res) => {
    const username = req.params.username.toLowerCase()
    const user = await User.query()
      .authorize(req.user)
      .findOne({ username })

    res.send(user)
  })
  // for this request, you might want to only allow anonymous users to create an account,
  // and prevent them from writing anything they're not allowed to (e.g. id/role)
  .post('/users', async (req, res) => {
    const user = await User.query()
      .authorize(req.user, null, {
        unauthorizedErrorCode: 405, // if you're logged in, then this method is not allowed
        userFromResult: true // include this to "update" the requester so that they can see their email
      })
      .insert(req.body)
      .returning('*')

    // then login with the user...
  })
  // standard "authorize user before they can access/change resources" scheme here:
  .patch('/users/:username', async (req, res) => {
    const username = req.params.username.toLowerCase()
    // we fetch the user first to provide resource context for the authorize() call.
    // Note that if we were to just call User.query().patchAndFetchById() and skip resource,
    // then the requester would be able to modify any user before we can even authorize them!
    let user = await User.query().findOne({ username })
    user = await user
      .$query()
      .authorize(req.user)
      .patchAndFetch(req.body)

    res.send(user)
  })
```

For a real-life example, see here: https://github.com/JaneJeon/express-objection-starter/blob/master/routes/users.js

## Run tests

```sh
yarn test
```

## Author

👤 **Jane Jeon**

- Github: [@JaneJeon](https://github.com/JaneJeon)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/JaneJeon/objection-authorize/issues).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2019 [Jane Jeon](https://github.com/JaneJeon).<br />
This project is [MIT](https://github.com/JaneJeon/objection-authorize/blob/master/LICENSE) licensed.
