import { Meteor } from 'meteor/meteor';
import { Mongo, MongoInternals } from 'meteor/mongo';
import { check, Match } from 'meteor/check';

const getRawCollection = name => Meteor.isServer && MongoInternals.defaultRemoteCollectionDriver().mongo.db.collection(name);

/**
 * @typedef {Object} ArchiveConfig
 * @property {string} name - The name given to your Archives collection, defaults to "archives"
 * @property {boolean} overrideRemove - Automatically override the remove method to make it an archive, defaults to true
 * @property {string[]} exclude - Exclude collections by name from using the archive mechanism
 */

/**
 * Configuration object for archive.
 *
 * @type {ArchiveConfig}
 */
const config = {
  name: 'archives',
  overrideRemove: true,
  exclude: ['roles', 'role-assignment']
};

/**
 * Configures the settings by merging the provided options with the existing configuration.
 *
 * @param {Object} options - The options to configure.
 * @param {string} [options.name] - The name given to your Archives collection
 * @param {boolean} [options.overrideRemove] - Automatically override or prevent overriding the remove method to make it an archive. Defaults to true.
 * @param {boolean} [options.exclude] - Exclude collections by name from using the archive mechanism
 * @returns {ArchiveConfig} The updated configuration object.
 */
const configure = options => {
  check(options, {
    name: Match.Maybe(String),
    overrideRemove: Match.Maybe(Boolean),
    exclude: Match.Maybe([String])
  });

  return Object.assign(config, options);
};


/**
 * Archive configuration
 *
 * @type {Object}
 * @property {ArchiveConfig} config - The current archive configuration
 * @property {Function} configure - Method to update the configuration
 */
export const Archive = Object.freeze({
  config,
  configure
});

async function archiveAsync(selector) {
  const _collection = this._name;
  const archiveName = config.name;
  const archiveCollection = Mongo.getCollection(archiveName);
  const archiveRawCollection = getRawCollection(archiveName);

  return Mongo.withTransaction(async () => {
    const docs = await this.find(selector).fetchAsync();
    if (!docs.length) {
      return 0;
    }

    const ids = [];

    for (const doc of docs) {
      ids.push(doc._id);
      doc.id = doc._id;
      delete doc._id;
      doc._id = archiveCollection?._makeNewID(); // make sure we get use a meteor-style _id unless using object _ids
      doc._collection = _collection;
      doc.archivedAt = new Date();
    }

    await this.removeAsync({_id: {$in: ids}}, { forever: true });

    Meteor.isClient
      ? await Promise.all(docs.map(async d => await archiveCollection?.insertAsync(d)))
      : await archiveRawCollection.insertMany(docs);

    return docs.length;
  });
}

async function restoreAsync(selector) {
  const _collection = this._name;
  const rawCollection = getRawCollection(_collection);
  const archiveCollection = Mongo.getCollection(config.name);

  return Mongo.withTransaction(async () => {
    const archivedDocs = await archiveCollection.find({ _collection, ...selector }).fetchAsync();
    if (!archivedDocs.length) {
      return 0;
    }

    const docs = [];
    const archiveIds = [];

    for (const archiveDoc of archivedDocs) {
      const { _id, _collection, archivedAt, ...doc } = archiveDoc;
      archiveIds.push(_id);

      doc._id = doc.id;
      delete doc.id;
      docs.push(doc);
    }

    Meteor.isClient
      ? await Promise.all(docs.map(async d => await this.insertAsync(d)))
      : await rawCollection.insertMany(docs);

    await archiveCollection?.removeAsync({_id: {$in: archiveIds}}, { forever: true });

    return archivedDocs.length;
  });
}

/**
 * Asynchronously performs an archive operation on documents in the MongoDB collection.
 * This method uses a transaction to remove the documents from the collection and put them in the Archive Collection.
 *
 * @async
 * @function
 * @name Mongo.Collection#archiveAsync
 * @param {Object} selector - The MongoDB query selector to identify documents for the archive removal operation.
 * @returns {Promise<number>} - A promise that resolves to the number of documents archived.
 * @throws {Error} - Throws an error if the operation fails.
 */
Mongo.Collection.prototype.archiveAsync = archiveAsync;


/**
 * Asynchronously restores documents that were previously archived.
 * This method uses a transaction to restore the documents from the Archive collection and put them back in the original collection as they were
 *
 * @async
 * @function
 * @name Mongo.Collection#restoreAsync
 * @param {Object} selector - The MongoDB query selector to identify the documents to be restored.
 * @returns {Promise<number>} - A promise that resolves to the number of documents successfully restored.
 * @throws {Error} - Throws an error if the operation fails.
 */
Mongo.Collection.prototype.restoreAsync = restoreAsync;

Meteor.startup(() => {
  const { overrideRemove, exclude } = config;

  if (overrideRemove) {
    const originalRemove = Mongo.Collection.prototype.removeAsync;

    Mongo.Collection.prototype.removeAsync = async function(selector, options = {}) {
      if (options.forever || exclude.includes(this._name)) {
        return originalRemove.call(this, selector);
      }

      return Mongo.Collection.prototype.archiveAsync.call(this, selector);
    }
  }
});

