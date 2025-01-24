# [User Manual](README.md) > [Steps](steps.md) > SubInstance

Next: [Settings](settings.md),
Previous: [Steps > PushPull](push-pull.md)

## Table of contents
- [Description](#description)
  - [Parameters](#parameters)

## Description
A SubInstance [creates a nested instance of the selected body](browser.md#bodies) (child) inside the edited body (parent). The resulting child instance can be [positioned](#placement) relative to its parent.

All instances of the same body as the parent will also adopt a child instance, and all changes to the SubInstance or the child's body will be reflected automatically in all parents.

A child cannot be of the same body, or itself contain in its hierarchy a child whose body is the same as the parent's body.

Deleting a child deletes its parent's body corresponding SubInstance step instead.

### Parameters

#### Placement
Name     | Type                              | Description
---------|-----------------------------------|------------
Position | [3D coordinate](editor.md#value-types) | The position of the SubInstance in relation to the body
Axis     | [3D vector](editor.md#value-types)     | The rotation axis of the SubInstance
Angle    | [angle](editor.md#value-types)         | The angle the SubInstance is rotated around the rotation axis
Scale    | [3D vector](editor.md#value-types)     | The size of the SubInstance
