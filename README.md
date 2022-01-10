<h1 align="center">Welcome to objection-authorize 👋</h1>

[![CircleCI](https://circleci.com/gh/JaneJeon/objection-authorize/tree/master.svg?style=shield)](https://circleci.com/gh/JaneJeon/objection-authorize/tree/master)
[![codecov](https://codecov.io/gh/JaneJeon/objection-authorize/branch/master/graph/badge.svg)](https://codecov.io/gh/JaneJeon/objection-authorize)
[![NPM](https://img.shields.io/npm/v/objection-authorize)](https://www.npmjs.com/package/objection-authorize)
[![Downloads](https://img.shields.io/npm/dt/objection-authorize)](https://www.npmjs.com/package/objection-authorize)
[![Docs](https://img.shields.io/badge/docs-github-blue)](https://janejeon.github.io/objection-authorize)

> isomorphic, &#34;magical&#34; access control integrated with objection.js

This plugin automatically takes away a lot of the manual wiring that you'd need to do if you were to implement your access control on a request/route level, including:

- checking the user against the resource and the ACL
- filtering request body according to the action and the user's access
- figuring out _which_ resource to check the user's grants against automatically(!)
- even filtering the result from a query according to a user's read access!

Not sure why you would need this? Read below for examples or [see here](https://janejeon.dev/integrating-access-control-to-your-node-js-apps) to learn just how complex access control can be and how you can manage said complexity with this plugin!

**TL;DR:**

Before:

```js
class Post extends Model {}

app.put('/posts/:id', (req, res, next) => {
  // Need to handle random edge cases like the user not being signed in
  if (!req.user) next(new Error('must be signed in'))

  // Need to first fetch the post to know "can this user edit this post?"
  Post.query()
    .findById(req.params.id)
    .then(post => {
      if (req.user.id !== post.authorId || req.user.role !== 'editor')
        return next(new Error("Cannot edit someone else's post!"))

      // Prevent certain fields from being set after creation
      const postBody = omit(req.body, ['id', 'views', 'authorId'])

      // Prevent certain fields from being *changed*
      if (
        post.visibility === 'public' &&
        get(postBody, 'visibility') !== post.visibility &&
        req.user.role !== 'admin'
      )
        return next(
          new Error('Cannot take down a post without admin privileges!')
        )

      req.user
        .$relatedQuery('posts')
        .updateAndFetchById(post.id, postBody)
        .then(post => {
          // filter the resulting post based on user's access before sending it over
          if (req.user.role !== 'admin') post = omit(post, ['superSecretField'])

          res.send(post)
        })
        .catch(err => next(err))
    })
    .catch(err => next(err))
})

// And you need to repeat ALL of this validation on the frontend as well...
```

After:

```js
// Use the plugin...
class Post extends require('objection-authorize')(acl, library, opts)(Model) {}

app.put('/posts/:id', (req, res, next) => {
  // ...and the ACL is automagically hooked in for ALL queries!
  Post.query()
    .updateAndFetchById(req.params.id, req.body)
    .authorize(req.user)
    .fetchResourceContextFromDB()
    .diffInputFromResource()
    .then(post => {
      res.send(post.authorizeRead(req.user))
    })
    .catch(err => next(err))
})

// AND you can re-use the ACL on the frontend as well *without* any changes!
```

### 🏠 [Homepage](https://github.com/JaneJeon/objection-authorize)

> Enjoy objection-authorize? Check out my other objection plugins: [objection-hashid](https://github.com/JaneJeon/objection-hashid) and [objection-tablename](https://github.com/JaneJeon/objection-table-name)!

## Installation

To install the plugin itself:

```sh
yarn add objection-authorize # or
npm i objection-authorize --save
```

For now, only `@casl/ability` is supported as the authorization library, but this plugin is written in an implementation-agnostic way so that any AuthZ/ACL library could be implemented as long as the library of choice supports _synchronous_ authorization checks.

## Changelog

Starting from the 1.0 release, all changes will be documented at the [releases page](https://github.com/JaneJeon/objection-authorize/releases).

## Terminology

A quick note, I use the following terms interchangeably:

- `resource` and `item(s)` (both refer to model instance(s) that the query is fetching/modifying)
- `body` and `input` and `inputItem(s)` (all of them refer to the `req.body`/`ctx.body` that you pass to the query to modify said model instances; e.g. `Model.query().findById(id).update(inputItems)`)

## Usage

Plugging in `objection-authorize` to work with your existing authorization setup is as easy as follows:

```js
const acl = ... // see below for defining acl

const { Model } = require('objection')
const authorize = require('objection-authorize')(acl, library[, opts])

class Post extends authorize(Model) {
  // That's it! This is just a regular objection.js model class
}
```

### Options

You can pass an _optional_ options object as the third parameter during initialization. The default values are as follows:

```js
const opts = {
  defaultRole: 'anonymous',
  unauthenticatedErrorCode: 401,
  unauthorizedErrorCode: 403,
  castDiffToModelClass: true,
  ignoreFields: [],
  casl: {
    useInputItemAsResourceForRelation: false
  }
}
```

For explanations on what each option does, see below:

<details>
<summary>defaultRole</summary>

When the user object is empty, a "default" user object will be created with the `defaultRole` (e.g. `{ role: opts.defaultRole }`).

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
<summary>castDiffToModelClass</summary>

When you use `.diffInputFromResource()`, the resource and the inputItem are compared and a diff (an object containing the changes) is fed to your access control checker.

Since the diff is produced as a plain object, we need to cast it to the appropriate model class again so that you can access that model's methods and model-specific fields.

However, in some cases (such as when you're doing some bespoke field/value remapping in `Model.$parseJson()`), casting the object to the model class isn't "safe" to do, and the resulting model instance might contain different values from the raw diff object.

If you want to disable it, just set `opts.castDiffToModelClass` to false and the raw diff object will be fed to the access control functions.

</details>

<details>
<summary>ignoreFields</summary>

When you automatically modify/include some fields (e.g. automatic timestamps) in your Objection models, as objection-authorize is typically the "last" hook to run before execution, the policies will check for those fields as well.

These allow you to ignore those fields in authorization decisions. Note that you can specify the fields in dot notation as well (e.g. `timestamp.updatedAt`).

</details>

<details>
<summary>casl.useInputItemAsResourceForRelation</summary>

Normally, the `item` is used as "resource" since that's what the user is acting _on_.

However, for relation queries (e.g. add `Book` to a `Library`), the user is _really_ acting on the `Book`, not the `Library`. For cases like this, you can set this option to `true` in order to use the `inputItem` (`Book`) as "resource" instead of `item` (`Library`) **ONLY** during relation queries.

</details>

### Methods

After initialization, the following "magic" methods are available for use:

<details>
<summary>QueryBuilder.authorize(user[, resource[, opts]])</summary>

This is the bread and butter of this library. You can chain `.authorize()` to any Objection Model query (i.e. `Model.query().authorize()`) to authorize that specific ORM call/HTTP request.

First, an explanation of the parameters:

The `user` should be an object representation of the user; typically, you can just plug in `req.user` (express) or `ctx.user` (koa) directly, _even if the user is not signed in_ (aka `req.user === undefined`)!

The `resource` object is an optional parameter, and for most queries, you won't need to manually specify the resource.

The `opts` can be used to override any of the default options that you passed during initialization of this plugin (i.e. you don't have to pass the whole options object in; only the parts you want to override for this specific query).

So, what are we _actually_ checking here with this function?

When you chain `.authorize()` to the ORM query, the query is (typically) doing one of four things: create, read, update, or delete (CRUD) - which is the action they're trying to take. These correspond to the HTTP verbs: GET/POST/PUT/PATCH/DELETE (if you're not familiar with how this is the case, please read up on REST API design).

In addition, the query already provides the following contexts: the resource/item(s) that the user is acting on (e.g. read a **user**'s email, or create a **post**), the body/inputItem(s) that the user is supplying. This is typically the `req.body` that you pass to the `.insert()/.update()/.delete()` query methods, aka _how_ you want to change the resource.

So, given this information, we can just rely on the ACL (see below for how to define it) to check whether the `user` is allowed to take the specified `action` on `resource/items` with the given `body/inputItems`! Specifically, the authorization check involves the following functionalities:

1. Check if the user is allowed to apply the specified `action` on the `items`, and if not, throw an `httpError` with the appropriate HTTP error code
2. If there's `inputItems`, check if the user is allowed to modify/add the specific fields in `inputItems`. If a user tries to set/modify a property they're not allowed to, error is thrown again.

That's it!

The nuances of this plugin comes with how it's able to drastically simplify said ACL calls & context fetching. For example, while figuring out the `inputItems` might be simple, how does the plugin know which `items` the `action` applies to?

The plugin looks at the following places to fetch the appropriate `resource(s)`:

1. If the `resource` parameter is specified in the `.authorize()` call, it takes precedence and is set as the only item(s) that we check against.
2. If the `resource` parameter is not specified, then it looks at the model instance (if you're calling `.$query()` or `.$relatedQuery()`)
3. If you call `.fetchContextFromDB()`, then the plugin executes a pre-emptive SQL SELECT call to fetch the rows that the query would affect.

And once the plugin figures out `items` and `inputItems`, it simply iterates along both arrays and checks the ACL whether the user can take `action` on `items[i]` with input `inputItems[j]`.

That's it.

**TIP**: the `.authorize()` call can happen _anywhere_ within the query chain!

</details>

<details>
<summary>QueryBuilder.action(action)</summary>

Rather than using the "default" actions (create/read/update/delete), you can override the action per query.

This is useful when you have custom actions in your ACL (such as `promote`) for a specific endpoint/query. Just chain a `.action(customAction)` somewhere in the query (in this case, the `customAction` would be `"promote"`).

</details>

<details>
<summary>QueryBuilder.inputItem(inputItem)</summary>

For methods that don't support passing `inputItem(s)` (e.g. `.delete()`) but you still want to set the input item/resource, you can call this method to manually override the value of the resource used by the ACL.

</details>

<details>
<summary>QueryBuilder.fetchResourceContextFromDB()</summary>

Sometimes, you need to know the values of the resource(s) you're trying to access before you can make an authorization decision. So instead of loading the model instance(s) yourself and running `.$query()` on them, you can chain `.fetchResourceContextFromDB()` to your query and automatically populate the `inputs`/resources that would've been affected by the query.

e.g.

```js
await Person.query()
  .authorize(user)
  .where('lastName', 'george')
  .update({ lastName: 'George' }) // input item
  .fetchResourceContextFromDB() // Loads all people that would be affected by the update,
// and runs authorization check on *all* of those individuals against the input item.
```

</details>

<details>
<summary>QueryBuilder.diffInputFromResource()</summary>

This method is particularly useful for UPDATE requests, where the client is sending the _entire_ object (rather than just the changes, like PATCH). Obviously, if you put the whole object through the AuthZ check, it will trip up (for example, the client may include the object's id as part of an UPDATE request, and you don't want the ACL to think that the client is trying to change the id)!

Therefore, call this method anywhere along the query chain, and the plugin will automatically diff the input object(s) with whatever the resource is! The beauty of this method is that it also works for _nested fields_, so even if your table includes a JSON field, only the exact diff - all the way down to the nested subfields - will be passed along to the ACL.

e.g.

```js
Model.query()
  .authorize(user, { id: 1, foo: { bar: 'baz', a: 0 } })
  .updateById(id, { id: 1, foo: { bar: 'baz', b: 0 } })
  .diffInputFromResource() // the diff will be { foo: { b: 0 } }
```

**NOTE**: the plugin is ONLY able to detect changes to an existing field's value or an addition of a _new_ field, NOT the deletion of an existing field (see above how the implicit deletion of `foo.a` is not included in the diff).

Therefore, care must be taken during UPDATE queries where fields (_especially_ nested fields) may be added/removed dynamically. Having JSON subfields doesn't mean you throw out schema Mongo-style; so if you need to monitor for _deletion_ of a field (rather than mutation or addition), I would recommend assigning all of the possible fields' value with `null`, rather than leaving it out entirely, so that deletions would show up as mutations.

e.g. in the above case, if you wanted to check whether field `foo.a` was deleted or not:

```js
resource = { id: 1, foo: { bar: 'baz', a: 0, b: null } }
input = { id: 1, foo: { bar: 'baz', a: null, b: 0 } }
```

</details>

<details>
<summary>modelInstance.authorizeRead(user, [action = 'read'[, opts]])</summary>

Prior to objection-authorize v4, the plugin "automatically" filtered any resulting model instances against a user's read access, but it didn't work consistently and I found it to be too hacky, so from v4 and on, you will need to manually call the `.authorizeRead()` on your model instance to filter it according to the user's read access (which can be overridden with the `action` parameter).

This call is synchronous and will return the filtered model instance directly. Note that the result is a plain object, not an instance of the model _class_ anymore, since this call is meant to be for "finalizing" the model instance for returning to the user as a raw JSON.

</details>

## Defining the ACL

The ACL is what actually checks the validity of a request, and `objection-authorize` passes all of the necessary context in the form of function parameters (thus, you should wrap your ACL in the following function format):

```js
function acl(user, resource, action, body, opts) {
  // your ACL definition goes here
}
```

**NOTE**: while `user` is cast into plain object form (simply due to the fact that `req.user` could be empty, and we would need to create a "fake" user with a default role), `resource` and `body` (aka `item` and `inputItem`) are cast into their respective _Models_ - this is to maintain consistency with the internal Objection.js static hooks' behaviour.

For example, in a query:

```js
await Person.relatedQuery('pets')
  .for([1, 2])
  .insert([{ name: 'doggo' }, { name: 'catto' }])
  .authorize(user)
  .fetchContextFromDB()
```

The `resource` is an instance of model `Person`, and the `body` is an instance of model `Pet`. How do I know what class to wrap it in? Magic! ;)

### @casl/ability

For `casl`, because it doesn't allow dynamically checking against any resource or action, we have to wrap it with a function, and that function takes in `(user, resource, action, body, opts)` and returns an _instance_ of ability.

This is essentially the same as the `defineAbilitiesFor(user)` method described [in the casl docs](https://stalniy.github.io/casl/abilities/2017/07/20/define-abilities.html), but obviously with a lot more context.

So you might define your ability like this (and it doesn't matter if you use `AbilityBuilder` or `Ability`):

```js
const { AbilityBuilder } = require('@casl/ability')

function acl(user, resource, action, body, opts) {
  return AbilityBuilder.define((allow, forbid) => {
    if (user.isAdmin()) {
      allow('manage', 'all')
    } else {
      allow('read', 'all')
    }
  })
}
```

**TIP**: If you want to cut down on the time it takes to check access, one thing you might want to do is to use the `resource` parameter to ONLY define rules relevant to that resource:

```js
function acl(user, resource, action, body, opts) {
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

This also means that you _shouldn't_ rely on virtuals and asymmetrically-transformed fields on your ACL (if you want to use your ACL on the frontend, that is). For an example of symmetric transformation out in the wild, see https://github.com/JaneJeon/objection-hashid.

## Relation support

With objection-authorize v4, I added _experimental_ relation support, so on your ACL wrapper (the function that takes in 5 parameters - I really should just wrap them in an object but that would break compatibility), now there is an optional, 6th parameter called `relation`:

```js
function acl(user, resource, action, body, opts, relation) {
  // your ACL definition goes here
}
```

And that `relation` property is simply a string representation of the relation between `item` and `inputItem` that you specified in the resource model's `relationMappings`. So you can use that `relation` key to detect relations and do fancy things with it.

In reality, most of the relation support is well-tested and already proven to be working, as the hardest part was to wrap the `inputItem` in the appropriate related class (rather than using the same class for both the `item` and `inputItem`); it's just that I can't test the `relation` string itself due to some... Objection finnickyness.

## Run tests

```sh
npm test
```

## Author

👤 **Jane Jeon**

- Github: [@JaneJeon](https://github.com/JaneJeon)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/JaneJeon/objection-authorize/issues).

## Show your support

Give a ⭐️ if this project helped you!

## 📝 License

Copyright © 2022 [Jane Jeon](https://github.com/JaneJeon).<br />
This project is [LGPL](https://github.com/JaneJeon/objection-authorize/blob/master/LICENSE) licensed (TL;DR: please contribute back any improvements to this library).
