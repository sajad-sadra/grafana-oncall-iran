import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';

import { ServiceLabels, ServiceLabelsProps } from '@grafana/labels';
import { Field, Label } from '@grafana/ui';
import { isEmpty } from 'lodash-es';
import { observer } from 'mobx-react';

import { LabelKeyValue } from 'models/label/label.types';
import { useStore } from 'state/useStore';
import { openErrorNotification } from 'utils/utils';

export interface LabelsProps {
  value: LabelKeyValue[];
  errors: any;
  onDataUpdate?: ServiceLabelsProps['onDataUpdate'];
  description?: React.ComponentProps<typeof Label>['description'];
}

const _Labels = observer(
  forwardRef(function Labels2(props: LabelsProps, ref) {
    const { value: defaultValue, errors: propsErrors, onDataUpdate, description } = props;

    // propsErrors are 'external' caused by attaching/detaching labels to oncall entities,
    // state errors are errors caused by CRUD operations on labels storage

    const [value, setValue] = useState<LabelKeyValue[]>(defaultValue);

    const { labelsStore } = useStore();

    const onChange = (value: LabelKeyValue[]) => {
      if (onDataUpdate) {
        onDataUpdate(value);
      }
      setValue(value);
    };

    useImperativeHandle(
      ref,
      () => {
        return {
          getValue() {
            return value;
          },
        };
      },
      [value]
    );

    const cachedOnLoadKeys = useCallback(() => {
      let result = undefined;
      return async (search?: string) => {
        if (!result) {
          try {
            result = await labelsStore.loadKeys();
          } catch (error) {
            openErrorNotification('There was an error processing your request. Please try again');
          }
        }

        return result.filter((k) => k.name.toLowerCase().includes(search.toLowerCase()));
      };
    }, []);

    const isValid = () => {
      return (
        (propsErrors || [])
          .map((error: LabelKeyValue, index) => {
            // error object is empty => Valid
            if (isEmpty(error)) {
              return undefined;
            }
            const matchingValue = value[index]?.value;
            // We have a name for the value => Valid
            if (error.value && matchingValue?.name) {
              return undefined;
            }
            const matchingKey = value[index]?.key;
            // We have a name for the key => Valid
            if (error.key && matchingKey?.name) {
              return undefined;
            }
            // Invalid
            return error;
          })
          .filter((er: LabelKeyValue) => er).length === 0
      );
    };

    const cachedOnLoadValuesForKey = useCallback(() => {
      let result = undefined;
      return async (key: string, search?: string) => {
        if (!result) {
          try {
            const { values } = await labelsStore.loadValuesForKey(key, search);
            result = values;
          } catch (error) {
            openErrorNotification('There was an error processing your request. Please try again');
          }
        }

        return result.filter((k) => k.name.toLowerCase().includes(search.toLowerCase()));
      };
    }, []);

    return (
      <div>
        <Field label={<Label description={<div className="u-padding-vertical-xs">{description}</div>}>Labels</Label>}>
          <ServiceLabels
            loadById
            value={value}
            onLoadKeys={cachedOnLoadKeys()}
            onLoadValuesForKey={cachedOnLoadValuesForKey()}
            onCreateKey={labelsStore.createKey}
            onUpdateKey={labelsStore.updateKey}
            onCreateValue={labelsStore.createValue}
            onUpdateValue={labelsStore.updateKeyValue}
            onRowItemRemoval={(_pair, _index) => {}}
            onUpdateError={onUpdateError}
            errors={isValid() ? {} : { ...propsErrors }}
            onDataUpdate={onChange}
          />
        </Field>
      </div>
    );
  })
);

function onUpdateError(res) {
  if (res?.response?.status === 409) {
    openErrorNotification(`Duplicate values are not allowed`);
  } else {
    openErrorNotification('An error has occurred. Please try again');
  }
}

export const Labels = React.memo(_Labels);
