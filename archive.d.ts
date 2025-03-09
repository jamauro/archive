/**
 * Archive configuration
 */
export interface ArchiveConfig {
  name: string;
  overrideRemove: boolean;
  exclude: string[];
}

/**
 * Configures the settings by merging the provided options with the existing configuration.
 *
 * @param options - The options to configure.
 * @param {string} [options.name] - The name given to your Archives collection, defaults to "archives"
 * @param {boolean} [options.overrideRemove] - Automatically override or prevent overriding the remove method to make it an archive. Defaults to true.
 * @param {boolean} [options.exclude] - Exclude collections by name from using the archive mechanism
 * @returns The updated configuration object.
 */
export function configure(options: {
  name?: string;
  overrideRemove?: boolean;
  exclude?: string[];
}): ArchiveConfig;

/**
 * Archive utility that contains the configuration object and configure method.
 */
export const Archive: {
  config: ArchiveConfig;
  configure: typeof configure;
};

declare module 'meteor/mongo' {
  module Mongo {
    interface Collection<T> {
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
      archiveAsync(selector: Mongo.Selector<T>): Promise<number>;

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
      restoreAsync(selector: Mongo.Selector<T>): Promise<number>;
    }
  }
}
