const cloneDeep = require('lodash/cloneDeep');
const pick = require('lodash/pick');
const get = require('lodash/get');

module.exports = exports = function awesomeSchemaPlugin(schema, options) {
  let infoObj = cloneDeep(schema.paths);
  const unwantedKeys = get(options, 'unwantedKeys', ['__v']);
  const wantedParams = ['path', 'instance', 'options'];
  // console.log('SCHEMA', this.model.schema);
  let infoArray = [];

  for (let key in infoObj) {
    let info = infoObj[key];
    if (info.$isMongooseArray && info.caster) {
      if (info.caster.instance) {
        info.instance = info.instance + ':' + info.caster.instance;
      } else {
        info.instance = info.instance;
      }

      info.options = info.caster.options;
      if (info.options.type) delete info.options.type;
    }
    if (info.options && info.options.match) {
      info.options.match = info.options.match.toString();
      info.options.match = info.options.match.slice(
        1,
        info.options.match.length - 1
      );
    }
    if (unwantedKeys.indexOf(key) < 0) {
      infoArray.push(pick(info, wantedParams));
    }
  }

  let properties = {};

  if (options.model) {
    const { model } = options;
    properties.collectionName = model.collection.collectionName;
    properties.modelName = model.modelName;
    properties.indexes = model.schema._indexes || [];
  }

  infoArray = infoArray.map(infoElement => {
    if (infoElement.path === 'deleted' || infoElement.path === 'deletedAt') {
      infoElement.options.hidden = true;
    }
    if (infoElement.path === 'createdAt') {
      infoElement.options.label = 'Created At';
      infoElement.options.noedit = true;
      infoElement.options.initial = false;
    }
    if (infoElement.path === 'updatedAt') {
      infoElement.options.label = 'Updated At';
      infoElement.options.noedit = true;
      infoElement.options.initial = false;
    }
    if (infoElement.options.noedit === undefined)
      infoElement.options.noedit = false;
    if (infoElement.options.initial === undefined)
      infoElement.options.initial = false;
    if (infoElement.options.hidden === undefined)
      infoElement.options.hidden = false;
    if (infoElement.options.required) infoElement.options.initial = true;

    if (properties.extraEnums && properties.extraEnums[infoElement.path]) {
      let extra = properties.extraEnums[infoElement.path];
      infoElement.options.enum = infoElement.options.enum
        ? infoElement.options.enum.concat(extra)
        : extra;
    }

    if (
      properties.extraEnumsWithLabels &&
      properties.extraEnumsWithLabels[infoElement.path]
    ) {
      let extra = properties.extraEnumsWithLabels[infoElement.path];
      infoElement.options.enumWithLabels = infoElement.options.enumWithLabels
        ? infoElement.options.enumWithLabels.concat(extra)
        : extra;
    }

    return infoElement;
  });

  let awesomeSchema = {
    properties: properties,
    schema: infoArray,
    referencedInCollections: []
  };

  const mongoose = get(options, 'model.base');
  const modelName = get(options, 'model.modelName');
  if (mongoose.models && get(properties, 'modelName')) {
    let models = Object.keys(mongoose.models).filter(
      model => model !== get(properties, 'modelName')
    );
    let references = [];
    models.map((model, i) => {
      try {
        const paths = mongoose.model(model).schema.paths;
        const modelName = mongoose.model(model).modelName;
        Object.keys(paths)
          .map(path => {
            const field = paths[path];
            if (field.instance === 'ObjectID') {
              let reference = get(field, 'options.ref');
              if (reference === get(properties, 'modelName')) {
                const connectedModel = mongoose.models[model];
                return connectedModel.collection.collectionName;
              }
            }
          })
          .filter(ref => ref)
          .map(ref => references.push(ref));
      } catch (error) {
        console.log(error);
      }
    });
    awesomeSchema.referencedInCollections = references;
  }

  if (typeof options.transform "function" ) {
    options.transform(awesomeSchema, schema, model)
  }

  schema.info = () => awesomeSchema;
  model.info = () => awesomeSchema;
};
