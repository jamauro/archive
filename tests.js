import { Tinytest } from 'meteor/tinytest';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Archive } from 'meteor/jam:archive';

const Things = new Mongo.Collection('things');
const Archives = new Mongo.Collection('archives');

async function insertThing({ name }) {
  return Things.insertAsync({ name })
}

async function removeThing(_id) {
  return Things.removeAsync({ _id });
}

async function eraseThing(_id) {
  return Things.removeAsync({ _id }, { forever: true });
}

async function archiveThings(selector) {
  return Things.archiveAsync(selector);
}

async function restoreThings(selector) {
  return Things.restoreAsync(selector);
}

async function getThings(selector) {
  return Things.find(selector).fetchAsync();
}

async function getArchives(selector) {
  return Archives.find(selector).fetchAsync();
}

async function reset() {
  await Things.removeAsync({}, { forever: true });
  await Archives.removeAsync({}, { forever: true });
  return
}

Meteor.methods({ insertThing, removeThing, eraseThing, archiveThings, restoreThings, getArchives, getThings, reset });

Tinytest.add('configure', function (test) {
  const newConfig = {
    name: 'newArchives',
    overrideRemove: false,
    exclude: ['dogs']
  };

  Archive.configure(newConfig);
  const config = Archive.config;
  test.equal(config.name, 'newArchives');
  test.equal(config.overrideRemove, false);
  test.equal(config.exclude, ['dogs']);

  // reset to defaults
  Archive.configure({ name: 'archives', overrideRemove: true, exclude: [] })
});

Tinytest.addAsync('archiveAsync - should archive documents', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', {name: 'test'});
  const doc2 = await Meteor.callAsync('insertThing', {name: 'test'});

  const count = await Meteor.callAsync('archiveThings', {name: 'test'})

  test.equal(count, 2);

  const archivedDocs = await Meteor.callAsync('getArchives', {name: 'test'})
  test.equal(archivedDocs.length, 2);

  const originalDocs = await Meteor.callAsync('getThings', {})
  test.equal(originalDocs.length, 0);
});

Tinytest.addAsync('restoreAsync - should restore documents', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', { name: 'test1' });
  const doc2 = await Meteor.callAsync('insertThing', { name: 'test2' });

  await Meteor.callAsync('archiveThings', { name: 'test1' });
  await Meteor.callAsync('archiveThings', { name: 'test2' });

  const count = await Meteor.callAsync('restoreThings', { name: { $in: ['test1', 'test2'] } });

  test.equal(count, 2);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 2);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: { $in: ['test1', 'test2'] } });
  test.equal(archivedDocs.length, 0);
});

Tinytest.addAsync('removeAsync - overrideRemove should archive document', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', { name: 'test1' });
  const doc2 = await Meteor.callAsync('insertThing', { name: 'test2' });

  const count = await Meteor.callAsync('removeThing', doc1);

  test.equal(count, 1);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 1);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: 'test1' });
  test.equal(archivedDocs.length, 1);
});

Tinytest.addAsync('removeAsync - forever: true, should remove document forever', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', { name: 'test1' });
  const doc2 = await Meteor.callAsync('insertThing', { name: 'test2' });

  const count = await Meteor.callAsync('eraseThing', doc1);

  test.equal(count, 1);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 1);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: 'test1' });
  test.equal(archivedDocs.length, 0);
});

Tinytest.addAsync('archiveAsync - should only archive documents matching the selector', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', { name: 'test1' });
  const doc2 = await Meteor.callAsync('insertThing', { name: 'test2' });
  const doc3 = await Meteor.callAsync('insertThing', { name: 'test3' });

  const count = await Meteor.callAsync('archiveThings', { name: { $in: ['test1', 'test2'] } });

  test.equal(count, 2);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: { $in: ['test1', 'test2'] } });
  test.equal(archivedDocs.length, 2);

  const remainingDocs = await Meteor.callAsync('getArchives', { name: 'test3' });
  test.equal(remainingDocs.length, 0);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 1);
});

Tinytest.addAsync('restoreAsync - should return 0 if no matching archived documents found', async function (test) {
  await Meteor.callAsync('reset');

  const doc1 = await Meteor.callAsync('insertThing', { name: 'test1' });

  const count = await Meteor.callAsync('restoreThings', {name: 'test1'});

  test.equal(count, 0);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 1);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: 'test1' });
  test.equal(archivedDocs.length, 0);
});

Tinytest.addAsync('archiveAsync - should return 0 if no matching documents found to archive', async function (test) {
  await Meteor.callAsync('reset');

  const count = await Meteor.callAsync('archiveThings', { name: 'non-existent' });

  test.equal(count, 0);

  const archivedDocs = await Meteor.callAsync('getArchives', { name: 'non-existent' });
  test.equal(archivedDocs.length, 0);

  const originalDocs = await Meteor.callAsync('getThings', {});
  test.equal(originalDocs.length, 0);
});
